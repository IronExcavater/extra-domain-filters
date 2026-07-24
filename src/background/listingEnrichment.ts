import {
    enrichListingSnapshot,
    getCachedListing,
    cacheListing,
} from "../domain/listings/cache";
import type { ListingSnapshot } from "../domain/matching";
import { getSettings } from "../shared/state/settings";

interface QueueEntry {
    attempts: number;
    listing: ListingSnapshot;
    nextAttemptAt: number;
}

const ALARM_NAME = "extra-domain-filters-listing-enrichment";
const QUEUE_KEY = "listingEnrichmentQueue";
const MAX_QUEUE_SIZE = 100;
let draining = false;

function normaliseUrl(url: string): string {
    return url.replace(/\/$/, "");
}

function isQueueEntry(value: unknown): value is QueueEntry {
    return typeof value === "object" && value !== null &&
        "attempts" in value && typeof value.attempts === "number" &&
        "listing" in value && typeof value.listing === "object" && value.listing !== null &&
        "nextAttemptAt" in value && typeof value.nextAttemptAt === "number";
}

async function readQueue(): Promise<QueueEntry[]> {
    const { [QUEUE_KEY]: raw } = await chrome.storage.local.get(QUEUE_KEY);
    return Array.isArray(raw) ? raw.filter(isQueueEntry) : [];
}

async function writeQueue(entries: readonly QueueEntry[]): Promise<void> {
    await chrome.storage.local.set({ [QUEUE_KEY]: entries.slice(0, MAX_QUEUE_SIZE) });
}

function retryDelay(attempts: number, status: "blocked" | "failed" | "throttled"): number {
    if (status === "blocked") return 7 * 24 * 60 * 60 * 1_000;
    if (status === "throttled") return Math.min(24 * 60 * 60 * 1_000, 15 * 60 * 1_000 * 2 ** attempts);
    return Math.min(6 * 60 * 60 * 1_000, 60_000 * 2 ** attempts);
}

async function hasFreshDetail(listing: ListingSnapshot, ttlMs: number): Promise<boolean> {
    const cached = await getCachedListing(listing.url);
    if (!cached || cached.text.length <= listing.text.length) return false;

    const { listingCache } = await chrome.storage.local.get("listingCache");
    const cache = typeof listingCache === "object" && listingCache !== null
        ? listingCache as Record<string, { cachedAt?: unknown }>
        : {};
    const entry = cache[normaliseUrl(listing.url)];
    return typeof entry?.cachedAt === "number" && Date.now() - entry.cachedAt < ttlMs;
}

function arm(): void {
    chrome.alarms.create(ALARM_NAME, { delayInMinutes: 0.1 });
}

export async function enqueueListingEnrichment(listings: readonly ListingSnapshot[]): Promise<void> {
    const settings = await getSettings();
    if (!settings.filters.enrichListingDetails) return;

    const queue = await readQueue();
    const queued = new Set(queue.map(entry => normaliseUrl(entry.listing.url)));
    for (const listing of listings) {
        const key = normaliseUrl(listing.url);
        if (queued.has(key) || await hasFreshDetail(listing, settings.cache.ttlMs)) continue;

        queued.add(key);
        queue.push({ attempts: 0, listing, nextAttemptAt: Date.now() });
        if (queue.length >= MAX_QUEUE_SIZE) break;
    }
    await writeQueue(queue);
    arm();
}

export async function drainListingEnrichmentQueue(): Promise<void> {
    if (draining) return;
    draining = true;

    try {
        const settings = await getSettings();
        if (!settings.filters.enrichListingDetails) return;

        const queue = await readQueue();
        const now = Date.now();
        const index = queue.findIndex(entry => entry.nextAttemptAt <= now);
        if (index === -1) {
            if (queue.length > 0) arm();
            return;
        }

        const entry = queue[index];
        const controller = new AbortController();
        const timeout = setTimeout(() => controller.abort(), 8_000);
        const result = await enrichListingSnapshot(entry.listing, controller.signal).finally(() => clearTimeout(timeout));

        if (result.status === "enriched" && result.listing) {
            await cacheListing(result.listing);
            queue.splice(index, 1);
        } else {
            const status = result.status === "enriched" ? "failed" : result.status;
            queue[index] = {
                ...entry,
                attempts: entry.attempts + 1,
                nextAttemptAt: now + retryDelay(entry.attempts, status),
            };
        }

        await writeQueue(queue);
        if (queue.length > 0) {
            await new Promise(resolve => setTimeout(resolve, settings.queue.minSpacingMs));
            arm();
        }
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
