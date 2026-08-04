import { cacheListing, getCachedListingEntries } from "../domain/listings/cache";
import { enrichListingSnapshot } from "../domain/listings/detail";
import {
    ENRICHMENT_ALARM_DELAY_MS,
    ENRICHMENT_BLOCK_DURATION_MS,
    ENRICHMENT_BLOCKLIST_CAPACITY,
    ENRICHMENT_PAUSE_DURATION_MS,
    ENRICHMENT_QUEUE_CAPACITY,
    getEnrichmentLimits,
    getRetryDelay,
    type EnrichmentQueueLimits,
} from "../domain/listings/enrichmentPolicy";
import { normalizeListingUrl } from "../domain/listings/url";
import type { ListingSnapshot } from "../domain/matching";
import { getSettings } from "../shared/state/settings";

interface QueueEntry {
    attempts: number;
    leaseId?: string;
    listing: ListingSnapshot;
    nextAttemptAt: number;
}

interface EnrichmentState {
    blockedUntil: Record<string, number>;
    pausedUntil?: number;
}

const ALARM_NAME = "extra-domain-filters-listing-enrichment";
const QUEUE_KEY = "listingEnrichmentQueue";
const STATE_KEY = "listingEnrichmentState";
let draining = false;
let queueOperations = Promise.resolve();

function isQueueEntry(value: unknown): value is QueueEntry {
    return typeof value === "object" && value !== null &&
        "attempts" in value && typeof value.attempts === "number" &&
        "listing" in value && typeof value.listing === "object" && value.listing !== null &&
        "nextAttemptAt" in value && typeof value.nextAttemptAt === "number";
}

async function readQueue(): Promise<QueueEntry[]> {
    const { [QUEUE_KEY]: raw } = await chrome.storage.local.get(QUEUE_KEY);
    return Array.isArray(raw) ? raw.filter(isQueueEntry).slice(0, ENRICHMENT_QUEUE_CAPACITY) : [];
}

async function readState(): Promise<EnrichmentState> {
    const { [STATE_KEY]: raw } = await chrome.storage.local.get(STATE_KEY);
    const blockedUntil = typeof raw === "object" && raw !== null &&
        "blockedUntil" in raw && typeof raw.blockedUntil === "object" && raw.blockedUntil !== null
        ? Object.fromEntries(Object.entries(raw.blockedUntil).filter(([, until]) => typeof until === "number"))
        : {};
    const pausedUntil = typeof raw === "object" && raw !== null &&
        "pausedUntil" in raw && typeof raw.pausedUntil === "number" ? raw.pausedUntil : undefined;
    return { blockedUntil, pausedUntil };
}

async function writeQueue(entries: readonly QueueEntry[]): Promise<void> {
    await chrome.storage.local.set({ [QUEUE_KEY]: entries.slice(0, ENRICHMENT_QUEUE_CAPACITY) });
}

async function mutateQueue<T>(operation: () => Promise<T>): Promise<T> {
    const next = queueOperations.then(operation, operation);
    queueOperations = next.then(() => undefined, () => undefined);
    return next;
}

function arm(delayMs = ENRICHMENT_ALARM_DELAY_MS): void {
    chrome.alarms.create(ALARM_NAME, {
        delayInMinutes: Math.max(ENRICHMENT_ALARM_DELAY_MS, delayMs) / 60_000,
    });
}

function compactState(state: EnrichmentState, now: number): EnrichmentState {
    const active = Object.entries(state.blockedUntil)
        .filter(([, until]) => until > now)
        .sort(([, first], [, second]) => second - first)
        .slice(0, ENRICHMENT_BLOCKLIST_CAPACITY);
    return {
        blockedUntil: Object.fromEntries(active),
        pausedUntil: state.pausedUntil && state.pausedUntil > now ? state.pausedUntil : undefined,
    };
}

export async function enqueueListingEnrichment(listings: readonly ListingSnapshot[]): Promise<void> {
    const settings = await getSettings();
    if (!settings.filters.enrichListingDetails) return;

    await mutateQueue(async () => {
        const now = Date.now();
        const [queue, state, cached] = await Promise.all([
            readQueue(),
            readState(),
            getCachedListingEntries(listings.map(listing => listing.url)),
        ]);
        const compacted = compactState(state, now);
        const queued = new Set(queue.map(entry => normalizeListingUrl(entry.listing.url)));
        for (const listing of listings) {
            const key = normalizeListingUrl(listing.url);
            const cachedListing = cached.get(key);
            if (queued.has(key) || compacted.blockedUntil[key] ||
                (cachedListing && Date.now() - cachedListing.cachedAt < settings.cache.ttlMs &&
                    cachedListing.listing.text.length > listing.text.length)) continue;
            queued.add(key);
            queue.push({ attempts: 0, listing, nextAttemptAt: Math.max(now, compacted.pausedUntil ?? 0) });
            if (queue.length >= ENRICHMENT_QUEUE_CAPACITY) break;
        }
        await Promise.all([writeQueue(queue), chrome.storage.local.set({ [STATE_KEY]: compacted })]);
    });
    arm();
    void drainListingEnrichmentQueue();
}

async function claimReadyEntries(): Promise<{ entries: QueueEntry[]; limits: EnrichmentQueueLimits }> {
    const settings = await getSettings();
    const limits = getEnrichmentLimits(settings.queue.enrichmentPace);
    if (!settings.filters.enrichListingDetails) return { entries: [], limits };

    return mutateQueue(async () => {
        const now = Date.now();
        const state = compactState(await readState(), now);
        if (state.pausedUntil) {
            await chrome.storage.local.set({ [STATE_KEY]: state });
            arm(state.pausedUntil - now);
            return { entries: [], limits };
        }
        const queue = await readQueue();
        const entries = queue.filter(entry => entry.nextAttemptAt <= now).slice(0, limits.concurrency);
        for (const entry of entries) {
            entry.leaseId = crypto.randomUUID();
            entry.nextAttemptAt = now + limits.timeoutMs + limits.minSpacingMs;
        }
        await writeQueue(queue);
        return { entries: entries.map(entry => ({ ...entry })), limits };
    });
}

async function settleEntry(entry: QueueEntry, status: "blocked" | "enriched" | "failed" | "throttled", listing: ListingSnapshot | undefined, limits: EnrichmentQueueLimits): Promise<void> {
    await mutateQueue(async () => {
        const now = Date.now();
        const [queue, state] = await Promise.all([readQueue(), readState()]);
        const index = queue.findIndex(candidate => normalizeListingUrl(candidate.listing.url) === normalizeListingUrl(entry.listing.url) && candidate.leaseId === entry.leaseId);
        if (index === -1) return;

        if (status === "enriched" && listing) {
            await cacheListing(listing);
            queue.splice(index, 1);
        } else if (status === "blocked") {
            queue.splice(index, 1);
            state.blockedUntil[normalizeListingUrl(entry.listing.url)] = now + ENRICHMENT_BLOCK_DURATION_MS;
            state.pausedUntil = now + ENRICHMENT_PAUSE_DURATION_MS;
        } else if (status === "enriched" || entry.attempts >= limits.maxRetries) {
            queue.splice(index, 1);
        } else {
            queue[index] = {
                ...entry,
                attempts: entry.attempts + 1,
                leaseId: undefined,
                nextAttemptAt: now + getRetryDelay(status, entry.attempts),
            };
        }
        await Promise.all([writeQueue(queue), chrome.storage.local.set({ [STATE_KEY]: compactState(state, now) })]);
    });
}

export async function drainListingEnrichmentQueue(): Promise<void> {
    if (draining) return;
    draining = true;
    try {
        const { entries, limits } = await claimReadyEntries();
        if (entries.length === 0) return;
        await Promise.all(entries.map(async (entry, index) => {
            if (index > 0) await new Promise(resolve => setTimeout(resolve, limits.minSpacingMs * index));
            const controller = new AbortController();
            const timeout = setTimeout(() => controller.abort(), limits.timeoutMs);
            try {
                const result = await enrichListingSnapshot(entry.listing, controller.signal);
                const status: "blocked" | "enriched" | "failed" | "throttled" = result.status === "enriched"
                    ? result.listing ? "enriched" : "failed"
                    : result.status;
                await settleEntry(
                    entry,
                    status,
                    result.listing,
                    limits,
                );
            } catch {
                await settleEntry(entry, "failed", undefined, limits);
            } finally {
                clearTimeout(timeout);
            }
        }));
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
