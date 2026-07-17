import { getFromStorage, setInStorage } from "../../shared/platform/storage";
import type { ListingSnapshot } from "../matching";

interface ListingCacheEntry {
    listing: ListingSnapshot;
    cachedAt: number;
}

const CACHE_KEY = "listingCache";
const memoryCache = new Map<string, ListingCacheEntry>();
const pendingFetches = new Map<string, Promise<ListingSnapshot>>();

function normalizeUrl(url: string): string {
    return url.replace(/\/$/, "");
}

async function readCache(): Promise<Record<string, ListingCacheEntry>> {
    return (await getFromStorage<Record<string, ListingCacheEntry>>(CACHE_KEY)) ?? {};
}

async function writeCache(cache: Record<string, ListingCacheEntry>): Promise<void> {
    await setInStorage(CACHE_KEY, cache);
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

    const cache = await readCache();
    cache[key] = entry;
    await writeCache(cache);

    return listing;
}

function parseListingPage(html: string): Pick<ListingSnapshot, "text" | "thumbnailUrl"> {
    const document = new DOMParser().parseFromString(html, "text/html");
    const thumbnailUrl =
        document.querySelector<HTMLMetaElement>('meta[property="og:image"]')?.content ||
        document.querySelector<HTMLMetaElement>('meta[name="twitter:image"]')?.content ||
        undefined;

    return {
        text: document.body.textContent ?? "",
        thumbnailUrl,
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
            };
        })
        .then(cacheListing)
        .finally(() => pendingFetches.delete(key));

    pendingFetches.set(key, request);
    return request;
}
