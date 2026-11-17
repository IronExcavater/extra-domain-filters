import { DOMAIN_SETTLE_DELAY_MS, onBodyMutations } from "../../dom/bodyMutations";
import { getBlacklist } from "../../domain/blacklist/store";
import { getCachedListings } from "../../domain/listings/cache";
import { getSearchListings, mergeSearchSnapshot } from "../../domain/listings/searchData";
import { normalizeListingUrl } from "../../domain/listings/url";
import { matchListing, type BlacklistEntry, type ListingSnapshot } from "../../domain/matching";
import { type PageContext } from "../../platform/router";
import { onStorageChange } from "../../platform/storage";
import { getSettings, type Settings } from "../../state/settings";
import { isRevealed, REVEAL_CHANGE_EVENT } from "../listing-cards/exclusion/reveal";

// Domain's map is Google Maps with advanced markers; each carries its listing's coordinates
// ("-29.429953,153.321"), the same numbers as the listing's address in the page data. A
// marker with a count stands for several listings at one address.
const MARKER_SELECTOR = "gmp-advanced-marker[position]";
const PIN_ATTRIBUTE = "data-edf-pin";

type PinState = "hidden" | "match";

function positionKey(lat: number, lng: number): string {
    return `${lat.toFixed(5)},${lng.toFixed(5)}`;
}

function readMarkerKey(marker: Element): string | undefined {
    const [lat, lng] = (marker.getAttribute("position") ?? "").split(",").map(Number);
    return Number.isFinite(lat) && Number.isFinite(lng) ? positionKey(lat, lng) : undefined;
}

async function getListingsByPosition(): Promise<Map<string, ListingSnapshot[]>> {
    const renderedUrls = [...document.querySelectorAll<HTMLElement>('li[data-testid^="listing-"]')]
        .map(card => card.querySelector<HTMLAnchorElement>("a[href]")?.href)
        .filter((url): url is string => Boolean(url));
    const index = await getSearchListings(renderedUrls);
    // Descriptions fetched for the list view sharpen pin matches (could-haves, keywords).
    const cached = await getCachedListings([...index.values()].map(listing => listing.snapshot.url));
    const byPosition = new Map<string, ListingSnapshot[]>();
    for (const listing of index.values()) {
        if (listing.lat === undefined || listing.lng === undefined) continue;
        const detail = cached.get(normalizeListingUrl(listing.snapshot.url));
        const snapshot = detail
            ? mergeSearchSnapshot({ ...listing.snapshot, text: detail.text }, listing)
            : listing.snapshot;
        const key = positionKey(listing.lat, listing.lng);
        byPosition.set(key, [...byPosition.get(key) ?? [], snapshot]);
    }
    return byPosition;
}

/** Hidden when every listing at the pin is hidden in results; gold when one shown listing matches a could-have. */
function getPinState(
    listings: readonly ListingSnapshot[],
    settings: Settings,
    blacklist: readonly BlacklistEntry[],
): PinState | undefined {
    const matches = listings.map(listing =>
        matchListing(listing, settings, blacklist, { isFilteredListingRevealed: isRevealed }));
    const shown = matches.filter(match => match.exclusionReason === "none");
    if (shown.length === 0) return "hidden";
    return shown.some(match => match.matchedPreferences.length > 0) ? "match" : undefined;
}

export function bindMapPins(context: PageContext): void {
    const scope = context.scope.child("map-pins");
    let timer: number | undefined;
    let refreshing = false;
    let refreshQueued = false;

    const refresh = async (): Promise<void> => {
        if (refreshing) {
            refreshQueued = true;
            return;
        }
        refreshing = true;
        try {
            if (!document.querySelector(MARKER_SELECTOR)) return;
            const [listings, settings, blacklist = []] = await Promise.all([
                getListingsByPosition(),
                getSettings(),
                getBlacklist(),
            ]);
            if (scope.disposed) return;

            for (const marker of document.querySelectorAll<HTMLElement>(MARKER_SELECTOR)) {
                const key = readMarkerKey(marker);
                const atPin = key ? listings.get(key) : undefined;
                // Pins for listings the page data doesn't describe keep Domain's look.
                const state = atPin ? getPinState(atPin, settings, blacklist) : undefined;
                if (state) {
                    if (marker.getAttribute(PIN_ATTRIBUTE) !== state) marker.setAttribute(PIN_ATTRIBUTE, state);
                } else if (marker.hasAttribute(PIN_ATTRIBUTE)) {
                    marker.removeAttribute(PIN_ATTRIBUTE);
                }
            }
        } finally {
            refreshing = false;
            if (refreshQueued && !scope.disposed) {
                refreshQueued = false;
                schedule();
            }
        }
    };

    const schedule = (): void => {
        if (scope.disposed) return;
        if (timer !== undefined) window.clearTimeout(timer);
        timer = window.setTimeout(() => {
            timer = undefined;
            void refresh().catch(error => context.logger.warn("Failed to refresh map pins", error));
        }, DOMAIN_SETTLE_DELAY_MS);
    };

    onBodyMutations(mutations => {
        const relevant = mutations.some(mutation => [...mutation.addedNodes].some(node =>
            node instanceof Element && (node.matches(`${MARKER_SELECTOR}, #__NEXT_DATA__`) ||
                node.querySelector(MARKER_SELECTOR) !== null)));
        if (relevant) schedule();
    }, scope.signal);
    window.addEventListener(REVEAL_CHANGE_EVENT, schedule, { signal: scope.signal });
    scope.add(onStorageChange<BlacklistEntry[]>("blacklist", schedule));
    scope.add(onStorageChange("settings", schedule));
    scope.add(onStorageChange("listingCache", schedule));
    schedule();

    scope.add(() => {
        if (timer !== undefined) window.clearTimeout(timer);
        for (const marker of document.querySelectorAll(`[${PIN_ATTRIBUTE}]`)) marker.removeAttribute(PIN_ATTRIBUTE);
    });
}
