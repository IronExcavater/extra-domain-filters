import { createStorageRepository } from "../../shared/platform/repository";
import type { ListingSnapshot } from "../matching";
import { normalizeListingUrl } from "./url";

export interface ListingCacheEntry {
    listing: ListingSnapshot;
    cachedAt: number;
}

const CACHE_KEY = "listingCache";
const MAX_CACHE_ENTRIES = 250;
const memoryCache = new Map<string, ListingCacheEntry>();
const cacheRepository = createStorageRepository<Record<string, ListingCacheEntry>>({
    key: CACHE_KEY,
    version: 1,
    createDefault: () => ({}),
    normalize: value => value !== null && typeof value === "object" && !Array.isArray(value)
        ? value as Record<string, ListingCacheEntry>
        : {},
});

export async function clearListingCache(): Promise<void> {
    memoryCache.clear();
    await cacheRepository.clear();
}

function remember(key: string, entry: ListingCacheEntry): void {
    memoryCache.delete(key);
    memoryCache.set(key, entry);
    while (memoryCache.size > MAX_CACHE_ENTRIES) {
        const oldest = memoryCache.keys().next().value;
        if (!oldest) break;
        memoryCache.delete(oldest);
    }
}

async function readCache(): Promise<Record<string, ListingCacheEntry>> {
    return cacheRepository.get();
}

export async function getCachedListing(url: string): Promise<ListingSnapshot | undefined> {
    const key = normalizeListingUrl(url);
    const memory = memoryCache.get(key);
    if (memory) {
        remember(key, memory);
        return memory.listing;
    }

    const stored = (await readCache())[key];
    if (!stored) return undefined;

    remember(key, stored);
    return stored.listing;
}

export async function cacheListing(listing: ListingSnapshot): Promise<ListingSnapshot> {
    const key = normalizeListingUrl(listing.url);
    const entry = { listing, cachedAt: Date.now() };
    remember(key, entry);

    await cacheRepository.update(cache => {
        const next = { ...cache, [key]: entry };
        const keys = Object.entries(next)
            .sort(([, first], [, second]) => second.cachedAt - first.cachedAt)
            .slice(MAX_CACHE_ENTRIES)
            .map(([url]) => url);

        for (const url of keys) delete next[url];
        return next;
    });

    return listing;
}

export async function getCachedListingEntries(urls: readonly string[]): Promise<Map<string, ListingCacheEntry>> {
    const cache = await readCache();
    const entries = new Map<string, ListingCacheEntry>();

    for (const url of urls) {
        const key = normalizeListingUrl(url);
        const entry = memoryCache.get(key) ?? cache[key];
        if (!entry) continue;
        remember(key, entry);
        entries.set(key, entry);
    }

    return entries;
}

export async function getCachedListings(urls: readonly string[]): Promise<Map<string, ListingSnapshot>> {
    const entries = await getCachedListingEntries(urls);
    return new Map([...entries].map(([key, entry]) => [key, entry.listing]));
}
