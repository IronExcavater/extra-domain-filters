import { createStorageRepository } from "../../shared/platform/repository";
import type { ListingSnapshot } from "../matching";

interface ListingCacheEntry {
    listing: ListingSnapshot;
    cachedAt: number;
}

const CACHE_KEY = "listingCache";
const MAX_CACHE_ENTRIES = 250;
const memoryCache = new Map<string, ListingCacheEntry>();
const pendingFetches = new Map<string, Promise<ListingSnapshot>>();
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

function normalizeUrl(url: string): string {
    return url.replace(/\/$/, "");
}

async function readCache(): Promise<Record<string, ListingCacheEntry>> {
    return cacheRepository.get();
}

export async function getCachedListing(url: string): Promise<ListingSnapshot | undefined> {
    const key = normalizeUrl(url);
    const memory = memoryCache.get(key);
    if (memory) return memory.listing;

    const stored = (await readCache())[key];
    if (!stored) return undefined;

    memoryCache.set(key, stored);
    return stored.listing;
}

export async function cacheListing(listing: ListingSnapshot): Promise<ListingSnapshot> {
    const key = normalizeUrl(listing.url);
    const entry = { listing, cachedAt: Date.now() };
    memoryCache.set(key, entry);

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

function getImageUrls(document: Document): string[] {
    const urls = new Set<string>();
    const add = (value: string | null | undefined): void => {
        if (!value || !/domainstatic\.com\.au|domain\.com\.au\/image/i.test(value)) return;
        urls.add(value);
    };

    add(document.querySelector<HTMLMetaElement>('meta[property="og:image"]')?.content);
    add(document.querySelector<HTMLMetaElement>('meta[name="twitter:image"]')?.content);

    for (const image of document.querySelectorAll<HTMLImageElement>("img")) {
        const source = image.currentSrc || image.src;
        const description = `${source} ${image.alt}`.toLowerCase();
        if (/agency|logo/.test(description)) continue;
        add(source);
    }

    return [...urls].slice(0, 24);
}

function parseListingPage(html: string): Pick<ListingSnapshot, "text" | "thumbnailUrl" | "imageUrls"> {
    const document = new DOMParser().parseFromString(html, "text/html");
    const imageUrls = getImageUrls(document);

    return {
        text: document.body.textContent ?? "",
        thumbnailUrl: imageUrls[0],
        imageUrls,
    };
}

export async function getCachedListings(urls: readonly string[]): Promise<Map<string, ListingSnapshot>> {
    const cache = await readCache();
    const listings = new Map<string, ListingSnapshot>();

    for (const url of urls) {
        const key = normalizeUrl(url);
        const entry = memoryCache.get(key) ?? cache[key];
        if (!entry) continue;
        memoryCache.set(key, entry);
        listings.set(key, entry.listing);
    }

    return listings;
}

export type ListingEnrichmentStatus = "blocked" | "enriched" | "failed" | "throttled";

export interface ListingEnrichmentResult {
    listing?: ListingSnapshot;
    status: ListingEnrichmentStatus;
}

export async function enrichListingSnapshot(
    base: ListingSnapshot,
    signal: AbortSignal,
): Promise<ListingEnrichmentResult> {
    try {
        const response = await fetch(base.url, { signal });
        if (response.status === 401 || response.status === 403) return { status: "blocked" };
        if (response.status === 429) return { status: "throttled" };
        if (!response.ok) return { status: "failed" };

        const page = parseListingPage(await response.text());
        const listing = {
            ...base,
            text: `${base.text}\n${page.text}`,
            thumbnailUrl: page.thumbnailUrl ?? base.thumbnailUrl,
            imageUrls: [...new Set([...(base.imageUrls ?? []), ...(page.imageUrls ?? [])])],
        };

        return { listing, status: "enriched" };
    } catch (error) {
        if (error instanceof DOMException && error.name === "AbortError") throw error;
        return { status: "failed" };
    }
}

export async function resolveListingSnapshot(
    base: ListingSnapshot,
    options: { signal: AbortSignal; includeDetail: boolean }
): Promise<ListingSnapshot> {
    const cached = await getCachedListing(base.url);
    if (cached && (!options.includeDetail || cached.text.length > base.text.length)) {
        return { ...cached, ...base, text: cached.text || base.text };
    }

    if (!options.includeDetail) return cacheListing(base);

    const key = normalizeUrl(base.url);
    const pending = pendingFetches.get(key);
    if (pending) return pending;

    const request = enrichListingSnapshot(base, options.signal)
        .then(result => result.listing ?? base)
        .then(cacheListing)
        .finally(() => pendingFetches.delete(key));

    pendingFetches.set(key, request);
    return request;
}
