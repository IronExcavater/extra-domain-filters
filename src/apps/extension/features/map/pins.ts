import { onBodyMutations } from "../../dom/bodyMutations";
import { getBlacklist } from "../../domain/blacklist/store";
import { matchListing, type BlacklistEntry, type ListingSnapshot } from "../../domain/matching";
import { type PageContext } from "../../platform/router";
import { onStorageChange } from "../../platform/storage";
import { getSettings, type Settings } from "../../state/settings";
import { calibrateMap, findNearestPoint, type GeoPoint, type PixelPoint } from "./calibration";

const MARKER_SELECTOR = '[data-testid="single-marker"]';
const MAP_QUERY_KEY = /^(map|mapBounds|mapCenter|mapZoom)$/i;

interface MapListing extends GeoPoint {
    snapshot: ListingSnapshot;
}

interface MapPin {
    element: HTMLElement;
    pixel: PixelPoint;
}

function isRecord(value: unknown): value is Record<string, unknown> {
    return typeof value === "object" && value !== null;
}

function readString(value: unknown): string | undefined {
    return typeof value === "string" && value.trim() ? value : undefined;
}

function readCoordinate(value: unknown): number | undefined {
    return typeof value === "number" && Number.isFinite(value) ? value : undefined;
}

function extractMapListings(): MapListing[] {
    const source = document.getElementById("__NEXT_DATA__")?.textContent;
    if (!source) return [];

    let root: unknown;
    try {
        root = JSON.parse(source);
    } catch {
        return [];
    }

    const listings = new Map<string, MapListing>();
    const seen = new WeakSet<object>();

    const visit = (value: unknown): void => {
        if (!isRecord(value) && !Array.isArray(value)) return;
        if (seen.has(value)) return;
        seen.add(value);

        if (isRecord(value)) {
            const model = isRecord(value.listingModel) ? value.listingModel : value;
            const address = isRecord(model.address) ? model.address : undefined;
            const lat = readCoordinate(address?.lat);
            const lng = readCoordinate(address?.lng);
            const url = readString(model.url);

            if (lat !== undefined && lng !== undefined && url) {
                const absoluteUrl = new URL(url, window.location.origin).href;
                listings.set(absoluteUrl, {
                    lat,
                    lng,
                    snapshot: {
                        url: absoluteUrl,
                        title: readString(model.displayAddress) ?? readString(model.address) ?? "Domain listing",
                        displayAddress: readString(model.displayAddress),
                        text: [
                            readString(model.displayAddress),
                            readString(model.price),
                            Array.isArray(model.keywords) ? model.keywords.join(" ") : undefined,
                        ].filter((item): item is string => Boolean(item)).join("\n"),
                        price: readString(model.price),
                    },
                });
            }

            for (const child of Object.values(value)) visit(child);
            return;
        }

        for (const child of value) visit(child);
    };

    visit(root);
    return [...listings.values()];
}

function getMarkerPixel(marker: HTMLElement): PixelPoint | undefined {
    for (let current: HTMLElement | null = marker.parentElement; current; current = current.parentElement) {
        const left = Number.parseFloat(current.style.left);
        const top = Number.parseFloat(current.style.top);
        if (Number.isFinite(left) && Number.isFinite(top)) return { left, top };
    }

    return undefined;
}

function getMapPins(): MapPin[] {
    return [...document.querySelectorAll<HTMLElement>(MARKER_SELECTOR)]
        .map(element => {
            const pixel = getMarkerPixel(element);
            return pixel ? { element, pixel } : undefined;
        })
        .filter((pin): pin is MapPin => pin !== undefined);
}

function updatePin(pin: MapPin, listing: MapListing, settings: Settings, blacklist: BlacklistEntry[]): void {
    const match = matchListing(listing.snapshot, settings, blacklist);
    const excluded = match.exclusionReason !== "none";
    const nextDisplay = excluded ? "none" : "";

    if (pin.element.style.display !== nextDisplay) pin.element.style.display = nextDisplay;
    if (excluded) return;

    const color = match.matchedPreferences.length > 0 ? "#e7bc4f" : "#0b6500";
    for (const rect of pin.element.querySelectorAll<SVGRectElement>("rect")) {
        if (getComputedStyle(rect).fill === "rgb(124, 124, 123)") continue;
        if (rect.style.fill !== color) rect.style.fill = color;
    }
}

function hasMapQueryState(): boolean {
    return [...new URL(window.location.href).searchParams.keys()].some(key => MAP_QUERY_KEY.test(key));
}

function requestMapQueryState(): void {
    if (hasMapQueryState()) return;

    window.dispatchEvent(new Event("resize"));
}

export function bindMapPins(context: PageContext): void {
    const scope = context.scope.child("map-pins");
    let frame: number | undefined;
    let timer: number | undefined;
    let refreshing = false;
    let refreshQueued = false;
    let requestedMapState = false;
    let cachedSource = "";
    let cachedListings: MapListing[] = [];

    const refresh = async (): Promise<void> => {
        if (refreshing) {
            refreshQueued = true;
            return;
        }

        refreshing = true;
        try {
            const pins = getMapPins();
            if (pins.length === 0) return;

            if (!requestedMapState && !hasMapQueryState()) {
                requestedMapState = true;
                requestMapQueryState();
            }

            const source = document.getElementById("__NEXT_DATA__")?.textContent ?? "";
            if (source !== cachedSource) {
                cachedSource = source;
                cachedListings = extractMapListings();
            }
            if (cachedListings.length < 4) return;

            const calibration = calibrateMap(
                pins.map(pin => pin.pixel),
                cachedListings,
            );
            if (!calibration) return;

            const [settings, blacklist = []] = await Promise.all([getSettings(), getBlacklist()]);
            if (scope.disposed) return;

            for (const pin of pins) {
                const listing = findNearestPoint(calibration.toGeo(pin.pixel), cachedListings);
                if (listing) updatePin(pin, listing, settings, blacklist);
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
        if (frame !== undefined || scope.disposed) return;

        frame = requestAnimationFrame(() => {
            frame = undefined;
            if (timer !== undefined) window.clearTimeout(timer);
            timer = window.setTimeout(() => {
                timer = undefined;
                void refresh().catch(error => context.logger.warn("Failed to refresh map pins", error));
            }, 120);
        });
    };

    const resizeObserver = new ResizeObserver(schedule);
    const observeMarker = (marker: HTMLElement): void => {
        const container = marker.parentElement?.parentElement;
        if (container instanceof HTMLElement) resizeObserver.observe(container);
    };
    for (const marker of document.querySelectorAll<HTMLElement>(MARKER_SELECTOR)) {
        observeMarker(marker);
    }

    onBodyMutations(mutations => {
        const addedElements = mutations.flatMap(mutation =>
            [...mutation.addedNodes].filter((node): node is Element => node instanceof Element),
        );
        const markers = addedElements.flatMap(element => [
            ...(element.matches(MARKER_SELECTOR) ? [element] : []),
            ...element.querySelectorAll<HTMLElement>(MARKER_SELECTOR),
        ]);

        markers.forEach(marker => {
            if (marker instanceof HTMLElement) observeMarker(marker);
        });
        if (markers.length > 0 || addedElements.some(element => element.matches("#__NEXT_DATA__"))) schedule();
    }, scope.signal);
    scope.add(onStorageChange<BlacklistEntry[]>("blacklist", schedule));
    scope.add(onStorageChange("settings", schedule));
    schedule();

    scope.add(() => {
        resizeObserver.disconnect();
        if (frame !== undefined) cancelAnimationFrame(frame);
        if (timer !== undefined) window.clearTimeout(timer);
    });
}
