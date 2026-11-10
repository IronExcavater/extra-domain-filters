import type { ListingSnapshot } from "../matching";
import { normalizeListingUrl } from "./url";

/** A search result as Domain describes it in the page's Next.js data. */
export interface SearchListing {
    lat?: number;
    lng?: number;
    snapshot: ListingSnapshot;
}

type SearchIndex = Map<string, SearchListing>;

const NEXT_DATA_PATTERN = /<script id="__NEXT_DATA__"[^>]*>([\s\S]*?)<\/script>/;
let inline: { key: string; index: SearchIndex } | undefined;
const fetched = new Map<string, Promise<SearchIndex>>();

function isRecord(value: unknown): value is Record<string, unknown> {
    return typeof value === "object" && value !== null;
}

function readString(value: unknown): string | undefined {
    return typeof value === "string" && value.trim() ? value.trim() : undefined;
}

function readNumber(value: unknown): number | undefined {
    return typeof value === "number" && Number.isFinite(value) ? value : undefined;
}

/** "SwimmingPool" → "Swimming Pool", so keyword patterns written for prose still match. */
function humanize(token: string): string {
    return token.replace(/([a-z])([A-Z])/g, "$1 $2").replace(/([A-Z]+)([A-Z][a-z])/g, "$1 $2");
}

function readKeywords(value: unknown): string[] {
    const list = isRecord(value) && !Array.isArray(value) ? value.keywords : value;
    return Array.isArray(list) ? list.filter((item): item is string => typeof item === "string") : [];
}

function toSearchListing(model: Record<string, unknown>): SearchListing | undefined {
    const url = readString(model.url);
    if (!url) return undefined;

    const address = isRecord(model.address) ? model.address : undefined;
    const features = isRecord(model.features) ? model.features : undefined;
    const displayAddress = readString(model.displayAddress) ?? readString(model.projectName);
    const price = readString(model.price) ?? readString(model.priceFrom);
    const propertyType = readString(features?.propertyTypeFormatted) ?? readString(features?.propertyType);
    const keywords = readKeywords(model.keywords).map(humanize);
    const branding = isRecord(model.branding) ? model.branding : undefined;
    const agencyId = readNumber(branding?.agencyId)?.toString() ?? readString(branding?.agencyId);
    const agentNames = readString(branding?.agentNames)?.split(/\s*(?:,|&|\band\b)\s*/i).filter(Boolean);

    return {
        lat: readNumber(address?.lat),
        lng: readNumber(address?.lng),
        snapshot: {
            url: new URL(url, window.location.origin).href,
            title: displayAddress ?? "Domain listing",
            displayAddress,
            price,
            propertyType: propertyType && propertyType !== "Unknown" ? humanize(propertyType) : undefined,
            agencyId,
            agentNames,
            features: {
                bathrooms: readNumber(features?.baths)?.toString(),
                bedrooms: readNumber(features?.beds)?.toString(),
                parking: readNumber(features?.parking)?.toString(),
            },
            text: [displayAddress, price, propertyType && humanize(propertyType), ...keywords]
                .filter(Boolean)
                .join("\n"),
        },
    };
}

function parseIndex(source: string): SearchIndex {
    const index: SearchIndex = new Map();
    let root: unknown;
    try {
        root = JSON.parse(source);
    } catch {
        return index;
    }

    const seen = new WeakSet<object>();
    const visit = (value: unknown): void => {
        if (!isRecord(value) || seen.has(value)) return;
        seen.add(value);
        if (isRecord(value.listingModel)) {
            const listing = toSearchListing(value.listingModel);
            if (listing) index.set(normalizeListingUrl(listing.snapshot.url), listing);
        }
        for (const child of Object.values(value)) visit(child);
    };
    visit(root);
    return index;
}

function readInlineIndex(): SearchIndex {
    const source = document.getElementById("__NEXT_DATA__")?.textContent ?? "";
    const key = `${source.length}:${source.slice(0, 256)}`;
    if (inline?.key !== key) inline = { index: parseIndex(source), key };
    return inline.index;
}

function fetchPageIndex(href: string): Promise<SearchIndex> {
    const existing = fetched.get(href);
    if (existing) return existing;

    // Domain paginates client-side, which leaves the inline __NEXT_DATA__ on page one. One
    // same-origin request for the current results page refreshes the whole index at once.
    const request = fetch(href, { credentials: "include" })
        .then(response => response.ok ? response.text() : "")
        .then(html => parseIndex(html.match(NEXT_DATA_PATTERN)?.[1] ?? ""))
        .catch(() => new Map() as SearchIndex);
    fetched.set(href, request);
    while (fetched.size > 8) fetched.delete(fetched.keys().next().value as string);
    return request;
}

/**
 * Listings described by the current search results page. `expectedUrls` are the listings
 * currently rendered; when most are missing from the inline data the page has moved on
 * (client-side pagination) and the current URL's data is fetched once and cached.
 */
export async function getSearchListings(expectedUrls: readonly string[] = []): Promise<SearchIndex> {
    const index = readInlineIndex();
    // Only results pages paginate client-side; elsewhere the inline data is all there is.
    if (expectedUrls.length === 0 || !/^\/(sale|rent|sold|new-homes)\b/.test(window.location.pathname)) return index;

    const found = expectedUrls.filter(url => index.has(normalizeListingUrl(url))).length;
    if (found >= expectedUrls.length / 2) return index;

    const page = await fetchPageIndex(window.location.href);
    return page.size > 0 ? page : index;
}

/** Card text plus Domain's structured data (amenity keywords, property type) for matching. */
export function mergeSearchSnapshot(card: ListingSnapshot, search: SearchListing | undefined): ListingSnapshot {
    if (!search) return card;
    return {
        ...card,
        propertyType: card.propertyType ?? search.snapshot.propertyType,
        agencyId: card.agencyId ?? search.snapshot.agencyId,
        agentNames: card.agentNames ?? search.snapshot.agentNames,
        text: `${card.text}\n${search.snapshot.text}`,
    };
}
