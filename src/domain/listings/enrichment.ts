import { sendExtensionRequest } from "../../shared/platform/messages";
import type { ListingSnapshot } from "../matching";

export function requestListingEnrichment(listings: readonly ListingSnapshot[]): void {
    const candidates = listings
        .filter(listing => listing.url.startsWith("https://www.domain.com.au/"))
        .slice(0, 24)
        .map(({ url, title, text, displayAddress, propertyType, price }) => ({
            url,
            title,
            text,
            displayAddress,
            propertyType,
            price,
        }));

    if (candidates.length === 0) return;
    void sendExtensionRequest({ type: "listing:enrich", listings: candidates }).catch(() => undefined);
}
