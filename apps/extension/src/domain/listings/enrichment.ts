import { sendExtensionMessage } from "../../platform/messaging";
import type { ListingSnapshot } from "../matching";

const REQUEST_DEDUPLICATION_MS = 5 * 60_000;
const requestedAt = new Map<string, number>();

export function requestListingEnrichment(listings: readonly ListingSnapshot[]): void {
    const now = Date.now();
    for (const [url, timestamp] of requestedAt) {
        if (now - timestamp > REQUEST_DEDUPLICATION_MS) requestedAt.delete(url);
    }

    const seen = new Set<string>();
    const candidates = listings
        .filter(listing => {
            const key = listing.url.replace(/\/+$/, "");
            if (
                !listing.url.startsWith("https://www.domain.com.au/") ||
                seen.has(key) ||
                requestedAt.has(key)
            ) return false;
            seen.add(key);
            return true;
        })
        .slice(0, 24)
        .map(listing => {
            requestedAt.set(listing.url.replace(/\/+$/, ""), now);
            const { url, title, text, displayAddress, propertyType, price } = listing;
            return { url, title, text, displayAddress, propertyType, price };
        });

    if (candidates.length === 0) return;
    void sendExtensionMessage("listing:enrich", { listings: candidates }).catch(() => undefined);
}
