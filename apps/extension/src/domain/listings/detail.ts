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

const NEXT_DATA_PATTERN = /<script id="__NEXT_DATA__"[^>]*>([\s\S]*?)<\/script>/;
const OG_IMAGE_PATTERN = /<meta[^>]+property="og:image"[^>]+content="([^"]+)"/;

function isRecord(value: unknown): value is Record<string, unknown> {
    return typeof value === "object" && value !== null && !Array.isArray(value);
}

function strings(value: unknown): string[] {
    if (typeof value === "string") return [value];
    if (!Array.isArray(value)) return [];
    return value.flatMap(item => typeof item === "string"
        ? [item]
        : isRecord(item) && typeof item.name === "string" ? [item.name] : []);
}

/**
 * Reads the listing's own description, features and type from Domain's Next.js data. This
 * runs in the background service worker (no DOMParser) and ignores page chrome such as
 * navigation and "similar listings", which used to produce false keyword matches.
 */
function parseListingDetail(html: string): Pick<ListingSnapshot, "imageUrls" | "text" | "thumbnailUrl"> {
    const ogImage = html.match(OG_IMAGE_PATTERN)?.[1];
    let props: Record<string, unknown> = {};
    try {
        const data: unknown = JSON.parse(html.match(NEXT_DATA_PATTERN)?.[1] ?? "{}");
        const componentProps = isRecord(data) && isRecord(data.props) && isRecord(data.props.pageProps)
            ? data.props.pageProps.componentProps
            : undefined;
        if (isRecord(componentProps)) props = componentProps;
    } catch {
        props = {};
    }

    const imageUrls = [...new Set([ogImage, ...strings(props.heroImages)].filter((url): url is string =>
        Boolean(url) && /domainstatic\.com\.au|domain\.com\.au\/image/i.test(url ?? "")))].slice(0, MAX_IMAGE_URLS);
    const text = [
        ...strings(props.headline),
        ...strings(props.description),
        ...strings(props.features),
        ...strings(props.structuredFeatures),
        ...strings(props.propertyType),
    ].join("\n");

    return { imageUrls, text, thumbnailUrl: imageUrls[0] };
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
