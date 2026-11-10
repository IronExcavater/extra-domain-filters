import { onBodyMutations } from "../../dom/bodyMutations";
import { markOwned } from "../../dom/ownership";
import {
    getRecentSearches,
    rememberRecentSearch,
    type ExtensionRecentSearch,
} from "../../domain/searches/recentSearches";
import { observeUrlChanges, type PageContext } from "../../platform/router";
import { createUiButton } from "../../ui/elements";
import { replaceWithSavedSearchBellIcon } from "../../ui/icons";
import { bindPropertyAlertControls } from "./alerts";

const RECENT_SEARCH_SELECTOR = 'a[data-testid="recent-search-item"]';
// Domain's home module is a three-card row. Adding a fourth item makes the
// flex track wider than its section and was the source of the horizontal spill.
const MAX_VISIBLE_RECENT_SEARCHES = 3;

function getSearchTitle(search: ExtensionRecentSearch): string {
    const searchUrl = new URL(search.url, window.location.origin);
    const pathParts = searchUrl.pathname
        .split("/")
        .filter(Boolean);
    const locationSlug = pathParts[1];
    if (locationSlug) {
        const location = locationSlug
            .replace(/-(?:nsw|vic|qld|sa|wa|tas|nt|act)-\d{4}$/i, "")
            .split("-")
            .filter(Boolean)
            .map(word => `${word[0]?.toUpperCase() ?? ""}${word.slice(1)}`)
            .join(" ");
        if (location) return location;
    }
    const title = search.title
        .replace(/\s*\|\s*Domain.*$/i, "")
        .replace(/^Real Estate & Property for (?:Sale|Rent) in\s+/i, "")
        .trim();
    const looksLikeSerializedData = /^[{[]/.test(title);
    if (title && !looksLikeSerializedData) return title;

    const searchMode = pathParts[0]?.toLowerCase();
    if (searchMode === "sale" || searchMode === "rent") return "All Listings";
    return "Recent search";
}

function describeFilters(search: ExtensionRecentSearch): string {
    const params = new URLSearchParams(search.filterParams);
    const labels: string[] = [];

    if (params.has("could") || params.has("could-other")) labels.push("Could-haves");
    if (params.has("exclude")) labels.push("Excluded keywords");
    if (params.has("exclude-types")) labels.push("Excluded property types");
    if (params.has("strata-max")) labels.push("Strata limit");
    if (params.has("hide-non-matches")) labels.push("Matching listings only");
    return labels.join(" · ") || "Custom filters";
}

function createRecentSearchCard(
    search: ExtensionRecentSearch,
): HTMLElement {
    const card = document.createElement("article");
    const link = document.createElement("a");
    const content = document.createElement("span");
    const titleElement = document.createElement("h3");
    const description = document.createElement("span");
    const title = getSearchTitle(search);
    const alert = createUiButton({
        ariaLabel: "Create alert",
        icon: replaceWithSavedSearchBellIcon,
        tooltip: "Create alert",
        variant: "icon",
    });

    card.className = "edf-recent-search-card";
    card.dataset.edfRecentSearch = search.url;
    link.className = "edf-recent-search-link";
    link.dataset.testid = "edf-recent-search-item";
    link.href = search.url;
    content.className = "edf-recent-search-content";
    titleElement.textContent = title;
    description.className = "edf-recent-search-description";
    description.textContent = describeFilters(search);
    alert.classList.add("edf-recent-search-alert");
    alert.dataset.testid = "edf-recent-search-alert";
    alert.dataset.edfAlertIconOnly = "true";
    alert.dataset.edfAlertSearchUrl = search.url;
    alert.dataset.edfAlertSearchTitle = title;
    content.append(titleElement, description);
    link.append(content);
    card.append(link, alert);
    return markOwned(card, "recent-search");
}

async function renderRecentSearches(): Promise<void> {
    const searches = await getRecentSearches();
    const sources = [...document.querySelectorAll<HTMLAnchorElement>(RECENT_SEARCH_SELECTOR)];
    const host = sources[0]?.closest("article")?.parentElement;
    if (!host) return;
    host.dataset.edfRecentSearchHost = "true";
    const nativeUrls = new Set(sources.map(link => {
        const url = new URL(link.href, window.location.origin);
        url.searchParams.delete("lastsearchdate");
        url.searchParams.delete("page");
        url.searchParams.delete("pageNumber");
        url.searchParams.sort();
        return url.href;
    }));
    const visibleSearches = searches
        .filter(search => !nativeUrls.has(search.url))
        .slice(0, Math.max(0, MAX_VISIBLE_RECENT_SEARCHES - nativeUrls.size));
    const visibleUrls = new Set(visibleSearches.map(search => search.url));
    document.querySelectorAll<HTMLElement>("[data-edf-recent-search]").forEach(card => {
        if (!visibleUrls.has(card.dataset.edfRecentSearch ?? "")) card.remove();
    });
    const existing = new Set(
        [...document.querySelectorAll<HTMLElement>("[data-edf-recent-search]")]
            .map(card => card.dataset.edfRecentSearch)
            .filter((url): url is string => Boolean(url)),
    );

    for (const search of visibleSearches) {
        if (existing.has(search.url)) continue;
        host.append(createRecentSearchCard(search));
    }
}

export function bindRecentSearchCapture(context: PageContext): void {
    const capture = (url: URL): void => {
        void rememberRecentSearch(url, document.title);
    };

    capture(context.url);
    observeUrlChanges(capture, context.signal);
}

export function bindRecentSearches(context: PageContext): void {
    let frame: number | undefined;
    const render = (): void => {
        if (frame !== undefined) return;
        frame = requestAnimationFrame(() => {
            frame = undefined;
            void renderRecentSearches().catch(error => context.logger.warn("Could not render recent searches", error));
        });
    };

    onBodyMutations(render, context.signal);
    bindPropertyAlertControls(context);
    context.signal.addEventListener("abort", () => {
        if (frame !== undefined) cancelAnimationFrame(frame);
    }, { once: true });
    render();
}
