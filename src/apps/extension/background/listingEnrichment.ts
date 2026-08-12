import { cacheListing, getCachedListingEntries } from "../domain/listings/cache";
import {
    enrichListingSnapshot,
    type ListingEnrichmentStatus,
} from "../domain/listings/detail";
import {
    ENRICHMENT_ALARM_DELAY_MS,
    ENRICHMENT_BLOCK_DURATION_MS,
    ENRICHMENT_PAUSE_DURATION_MS,
    getEnrichmentLimits,
    getRetryDelay,
    type EnrichmentQueueLimits,
} from "../domain/listings/enrichmentPolicy";
import { normalizeListingUrl } from "../domain/listings/url";
import type { ListingSnapshot } from "../domain/matching";
import { getSettings } from "../state/settings";
import {
    compactEnrichmentStore,
    updateEnrichmentStore,
    type EnrichmentQueueEntry,
} from "./listingEnrichmentStore";

const ALARM_NAME = "extra-domain-filters-listing-enrichment";
let draining = false;

function arm(delayMs = ENRICHMENT_ALARM_DELAY_MS): void {
    chrome.alarms.create(ALARM_NAME, {
        delayInMinutes: Math.max(ENRICHMENT_ALARM_DELAY_MS, delayMs) / 60_000,
    });
}

function hasFreshDetail(
    listing: ListingSnapshot,
    cachedAt: number,
    cachedText: string,
    ttlMs: number,
    now: number,
): boolean {
    return now - cachedAt < ttlMs && cachedText.length > listing.text.length;
}

function enqueueCandidates(
    queue: readonly EnrichmentQueueEntry[],
    listings: readonly ListingSnapshot[],
    blockedUntil: Readonly<Record<string, number>>,
    cached: ReadonlyMap<string, { cachedAt: number; listing: ListingSnapshot }>,
    cacheTtlMs: number,
    nextAttemptAt: number,
    now: number,
): EnrichmentQueueEntry[] {
    const queued = new Set(queue.map(entry => normalizeListingUrl(entry.listing.url)));
    const next = [...queue];

    for (const listing of listings) {
        const key = normalizeListingUrl(listing.url);
        const entry = cached.get(key);
        const fresh = entry && hasFreshDetail(listing, entry.cachedAt, entry.listing.text, cacheTtlMs, now);
        if (queued.has(key) || blockedUntil[key] || fresh) continue;

        queued.add(key);
        next.push({ attempts: 0, listing, nextAttemptAt });
    }

    return next;
}

export async function enqueueListingEnrichment(listings: readonly ListingSnapshot[]): Promise<void> {
    const settings = await getSettings();
    if (!settings.filters.enrichListingDetails) return;

    const now = Date.now();
    const cached = await getCachedListingEntries(listings.map(listing => listing.url));
    await updateEnrichmentStore(store => {
        const current = compactEnrichmentStore(store, now);
        return {
            ...current,
            queue: enqueueCandidates(
                current.queue,
                listings,
                current.blockedUntil,
                cached,
                settings.cache.ttlMs,
                Math.max(now, current.pausedUntil ?? 0),
                now,
            ),
        };
    });
    arm();
    void drainListingEnrichmentQueue();
}

interface ReadyEntries {
    entries: EnrichmentQueueEntry[];
    limits: EnrichmentQueueLimits;
    pausedUntil?: number;
}

async function claimReadyEntries(): Promise<ReadyEntries> {
    const settings = await getSettings();
    const limits = getEnrichmentLimits(settings.queue.enrichmentPace);
    if (!settings.filters.enrichListingDetails) return { entries: [], limits };

    const now = Date.now();
    let entries: EnrichmentQueueEntry[] = [];
    let pausedUntil: number | undefined;
    await updateEnrichmentStore(store => {
        const current = compactEnrichmentStore(store, now);
        if (current.pausedUntil) {
            pausedUntil = current.pausedUntil;
            return current;
        }

        const leaseUntil = now + limits.timeoutMs + limits.minSpacingMs;
        const ready = current.queue
            .filter(entry => entry.nextAttemptAt <= now)
            .slice(0, limits.concurrency);
        entries = ready.map(entry => ({ ...entry, leaseId: crypto.randomUUID() }));
        const leaseIds = new Map(entries.map(entry => [normalizeListingUrl(entry.listing.url), entry.leaseId]));

        return {
            ...current,
            queue: current.queue.map(entry => {
                const leaseId = leaseIds.get(normalizeListingUrl(entry.listing.url));
                return leaseId ? { ...entry, leaseId, nextAttemptAt: leaseUntil } : entry;
            }),
        };
    });

    return { entries, limits, pausedUntil };
}

function retryEntry(entry: EnrichmentQueueEntry, status: "failed" | "throttled", now: number): EnrichmentQueueEntry {
    return {
        ...entry,
        attempts: entry.attempts + 1,
        leaseId: undefined,
        nextAttemptAt: now + getRetryDelay(status, entry.attempts),
    };
}

async function settleEntry(
    entry: EnrichmentQueueEntry,
    status: ListingEnrichmentStatus,
    listing: ListingSnapshot | undefined,
    limits: EnrichmentQueueLimits,
): Promise<void> {
    if (status === "enriched" && listing) await cacheListing(listing);

    const now = Date.now();
    await updateEnrichmentStore(store => {
        const current = compactEnrichmentStore(store, now);
        const index = current.queue.findIndex(candidate =>
            normalizeListingUrl(candidate.listing.url) === normalizeListingUrl(entry.listing.url) &&
            candidate.leaseId === entry.leaseId,
        );
        if (index === -1) return current;

        const queue = [...current.queue];
        if (status === "blocked") {
            queue.splice(index, 1);
            return {
                ...current,
                blockedUntil: {
                    ...current.blockedUntil,
                    [normalizeListingUrl(entry.listing.url)]: now + ENRICHMENT_BLOCK_DURATION_MS,
                },
                pausedUntil: now + ENRICHMENT_PAUSE_DURATION_MS,
                queue,
            };
        }
        if (status === "enriched" || entry.attempts >= limits.maxRetries) {
            queue.splice(index, 1);
            return { ...current, queue };
        }

        queue[index] = retryEntry(entry, status, now);
        return { ...current, queue };
    });
}

async function enrichEntry(
    entry: EnrichmentQueueEntry,
    index: number,
    limits: EnrichmentQueueLimits,
): Promise<void> {
    if (index > 0) await new Promise(resolve => setTimeout(resolve, limits.minSpacingMs * index));

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), limits.timeoutMs);
    try {
        const result = await enrichListingSnapshot(entry.listing, controller.signal);
        const status = result.status === "enriched" && !result.listing ? "failed" : result.status;
        await settleEntry(entry, status, result.listing, limits);
    } catch {
        await settleEntry(entry, "failed", undefined, limits);
    } finally {
        clearTimeout(timeout);
    }
}

export async function drainListingEnrichmentQueue(): Promise<void> {
    if (draining) return;
    draining = true;
    try {
        const { entries, limits, pausedUntil } = await claimReadyEntries();
        if (pausedUntil) {
            arm(pausedUntil - Date.now());
            return;
        }
        if (entries.length === 0) return;

        await Promise.all(entries.map((entry, index) => enrichEntry(entry, index, limits)));
        arm();
    } finally {
        draining = false;
    }
}

export function startListingEnrichment(): void {
    chrome.alarms.onAlarm.addListener(alarm => {
        if (alarm.name === ALARM_NAME) void drainListingEnrichmentQueue();
    });
    arm();
}
