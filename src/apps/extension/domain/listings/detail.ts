import type { ListingSnapshot } from "../matching";
import { cacheListing, getCachedListing } from "./cache";
import { normalizeListingUrl } from "./url";

const MAX_IMAGE_URLS = 24;
const pendingDetails = new Map<string, Promise<ListingSnapshot>>();

export type ListingEnrichmentStatus = "blocked" | "enriched" | "failed" | "throttled";

export interface ListingEnrichmentResult {
    listing?: ListingSnapshot;
    status: ListingEnrichmentStatus;
}

export interface ListingResolutionOptions {
    includeDetail: boolean;
    signal: AbortSignal;
}

function parseImageUrls(document: Document): string[] {
    const urls = new Set<string>();
    const add = (value: string | null | undefined): void => {
        if (value && /domainstatic\.com\.au|domain\.com\.au\/image/i.test(value)) urls.add(value);
    };

    add(document.querySelector<HTMLMetaElement>('meta[property="og:image"]')?.content);
    add(document.querySelector<HTMLMetaElement>('meta[name="twitter:image"]')?.content);
    for (const image of document.querySelectorAll<HTMLImageElement>("img")) {
        if (!/agency|logo/i.test(`${image.currentSrc || image.src} ${image.alt}`)) {
            add(image.currentSrc || image.src);
        }
    }
    return [...urls].slice(0, MAX_IMAGE_URLS);
}

function parseListingDetail(html: string): Pick<ListingSnapshot, "imageUrls" | "text" | "thumbnailUrl"> {
    const document = new DOMParser().parseFromString(html, "text/html");
    const imageUrls = parseImageUrls(document);

    return {
        imageUrls,
        text: document.body.textContent ?? "",
        thumbnailUrl: imageUrls[0],
    };
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

        const detail = parseListingDetail(await response.text());
        return {
            listing: {
                ...base,
                imageUrls: [...new Set([...(base.imageUrls ?? []), ...(detail.imageUrls ?? [])])],
                text: `${base.text}\n${detail.text}`,
                thumbnailUrl: detail.thumbnailUrl ?? base.thumbnailUrl,
            },
            status: "enriched",
        };
    } catch (error) {
        if (error instanceof DOMException && error.name === "AbortError") throw error;
        return { status: "failed" };
    }
}

export async function resolveListingSnapshot(
    base: ListingSnapshot,
    options: ListingResolutionOptions,
): Promise<ListingSnapshot> {
    const cached = await getCachedListing(base.url);
    if (cached && (!options.includeDetail || cached.text.length > base.text.length)) {
        return {
            ...base,
            ...cached,
            imageUrls: [...new Set([...(base.imageUrls ?? []), ...(cached.imageUrls ?? [])])],
            text: cached.text || base.text,
        };
    }
    if (!options.includeDetail) return cacheListing(base);

    const key = normalizeListingUrl(base.url);
    const pending = pendingDetails.get(key);
    if (pending) return pending;

    const request = enrichListingSnapshot(base, options.signal)
        .then(result => result.listing ?? base)
        .then(cacheListing)
        .finally(() => pendingDetails.delete(key));
    pendingDetails.set(key, request);
    return request;
}
