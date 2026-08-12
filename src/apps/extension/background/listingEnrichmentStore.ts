import {
    ENRICHMENT_BLOCKLIST_CAPACITY,
    ENRICHMENT_QUEUE_CAPACITY,
} from "../domain/listings/enrichmentPolicy";
import { parseListingSnapshot } from "../domain/listings/snapshot";
import type { ListingSnapshot } from "../domain/matching";
import { createStorageRepository } from "../platform/repository";
import { getFromStorage, removeLocalStorage } from "../platform/storage";
import { isPlainObject } from "../utils/types";

const STORE_KEY = "listingEnrichment";
const LEGACY_QUEUE_KEY = "listingEnrichmentQueue";
const LEGACY_STATE_KEY = "listingEnrichmentState";

export interface EnrichmentQueueEntry {
    attempts: number;
    leaseId?: string;
    listing: ListingSnapshot;
    nextAttemptAt: number;
}

export interface EnrichmentStore {
    blockedUntil: Record<string, number>;
    pausedUntil?: number;
    queue: EnrichmentQueueEntry[];
}

function numberValue(value: unknown): number | undefined {
    return typeof value === "number" && Number.isFinite(value) ? value : undefined;
}

function queueEntry(value: unknown): EnrichmentQueueEntry | undefined {
    if (!isPlainObject(value)) return undefined;
    const attempts = numberValue(value.attempts);
    const listing = parseListingSnapshot(value.listing);
    const nextAttemptAt = numberValue(value.nextAttemptAt);
    if (attempts === undefined || !listing || nextAttemptAt === undefined) return undefined;

    return {
        attempts,
        leaseId: typeof value.leaseId === "string" ? value.leaseId : undefined,
        listing,
        nextAttemptAt,
    };
}

function blockedEntries(value: unknown): Record<string, number> {
    if (!isPlainObject(value)) return {};

    const entries: Array<[string, number]> = [];
    for (const [url, until] of Object.entries(value)) {
        const timestamp = numberValue(until);
        if (timestamp !== undefined) entries.push([url, timestamp]);
    }
    return Object.fromEntries(entries);
}

function normalizeStore(value: unknown): EnrichmentStore {
    const stored = isPlainObject(value) ? value : {};
    const queue = Array.isArray(stored.queue)
        ? stored.queue.map(queueEntry).filter((entry): entry is EnrichmentQueueEntry => entry !== undefined)
        : [];

    return {
        blockedUntil: blockedEntries(stored.blockedUntil),
        pausedUntil: numberValue(stored.pausedUntil),
        queue: queue.slice(0, ENRICHMENT_QUEUE_CAPACITY),
    };
}

const repository = createStorageRepository<EnrichmentStore>({
    createDefault: () => ({ blockedUntil: {}, queue: [] }),
    key: STORE_KEY,
    normalize: normalizeStore,
    version: 1,
});

let legacyMigration: Promise<void> | undefined;

async function migrateLegacyStore(): Promise<void> {
    const current = await getFromStorage<unknown>(STORE_KEY);
    if (current !== undefined) return;

    const [queue, state] = await Promise.all([
        getFromStorage<unknown>(LEGACY_QUEUE_KEY),
        getFromStorage<unknown>(LEGACY_STATE_KEY),
    ]);
    if (queue === undefined && state === undefined) return;

    const legacyState = isPlainObject(state) ? state : {};
    await repository.set(normalizeStore({
        blockedUntil: legacyState.blockedUntil,
        pausedUntil: legacyState.pausedUntil,
        queue,
    }));
    await removeLocalStorage([LEGACY_QUEUE_KEY, LEGACY_STATE_KEY]);
}

async function ensureMigration(): Promise<void> {
    legacyMigration ??= migrateLegacyStore();
    await legacyMigration;
}

export async function getEnrichmentStore(): Promise<EnrichmentStore> {
    await ensureMigration();
    return repository.get();
}

export async function updateEnrichmentStore(
    update: (store: EnrichmentStore) => EnrichmentStore,
): Promise<EnrichmentStore> {
    await ensureMigration();
    return repository.update(update);
}

export function compactEnrichmentStore(store: EnrichmentStore, now: number): EnrichmentStore {
    const blockedUntil = Object.fromEntries(
        Object.entries(store.blockedUntil)
            .filter(([, until]) => until > now)
            .sort(([, first], [, second]) => second - first)
            .slice(0, ENRICHMENT_BLOCKLIST_CAPACITY),
    );

    return {
        blockedUntil,
        pausedUntil: store.pausedUntil && store.pausedUntil > now ? store.pausedUntil : undefined,
        queue: store.queue.slice(0, ENRICHMENT_QUEUE_CAPACITY),
    };
}
