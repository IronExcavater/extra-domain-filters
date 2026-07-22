import { createStorageRepository } from "../../shared/platform/repository";
import type { ListingSnapshot } from "../matching";

interface ListingCacheEntry {
    listing: ListingSnapshot;
    cachedAt: number;
}

const CACHE_KEY = "listingCache";
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

    await cacheRepository.update(cache => ({ ...cache, [key]: entry }));

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

    const request = fetch(base.url, { signal: options.signal })
        .then(async response => {
            if (!response.ok) return base;

            const page = parseListingPage(await response.text());

            return {
                ...base,
                text: `${base.text}\n${page.text}`,
                thumbnailUrl: page.thumbnailUrl ?? base.thumbnailUrl,
                imageUrls: [...new Set([...(base.imageUrls ?? []), ...(page.imageUrls ?? [])])],
            };
        })
        .then(cacheListing)
        .finally(() => pendingFetches.delete(key));

    pendingFetches.set(key, request);
    return request;
}
