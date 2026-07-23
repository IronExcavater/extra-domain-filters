import {
    getRecentSearchBaseUrl,
    getRecentSearches,
    rememberRecentSearch,
    type ExtensionRecentSearch,
} from "../../domain/searches/recentSearches";
import { onBodyMutations } from "../../shared/dom/bodyMutations";
import { markOwned } from "../../shared/dom/ownership";
import { observeUrlChanges, type PageContext } from "../../shared/platform/router";
import { bindPropertyAlertModal, setPropertyAlertSearchContext } from "./alerts";

const RECENT_SEARCH_SELECTOR = 'a[data-testid="recent-search-item"]';

function getSearchTitle(link: HTMLAnchorElement): string {
    return link.querySelector(".css-d3a0h7")?.textContent?.trim() ?? "Recent search";
}

function describeFilters(search: ExtensionRecentSearch): string {
    const params = new URLSearchParams(search.filterParams);
    const labels: string[] = [];

    if (params.has("could")) labels.push("Could-haves");
    if (params.has("exclude")) labels.push("Excluded keywords");
    if (params.has("exclude-types")) labels.push("Excluded property types");
    if (params.has("strata-max")) labels.push("Strata limit");
    if (params.has("hide-non-matches")) labels.push("Matching listings only");
    return labels.join(" · ") || "Custom filters";
}

function bindRecentAlert(
    button: HTMLButtonElement,
    url: string,
    title: string,
    source?: HTMLButtonElement,
): void {
    if (button.dataset.edfRecentAlertBound === "true") return;

    button.dataset.edfRecentAlertBound = "true";
    button.addEventListener("click", event => {
        const searchContext = {
            title: button.dataset.edfAlertSearchTitle ?? title,
            url: button.dataset.edfAlertSearchUrl ?? url,
        };
        setPropertyAlertSearchContext(searchContext);
        if (!source) return;

        event.preventDefault();
        event.stopPropagation();
        source.dataset.edfAlertSearchUrl = url;
        source.dataset.edfAlertSearchTitle = title;
        source.click();
        requestAnimationFrame(() => {
            delete source.dataset.edfAlertSearchUrl;
            delete source.dataset.edfAlertSearchTitle;
            setPropertyAlertSearchContext(searchContext);
        });
    }, { capture: true });
}

function createRecentSearchCard(
    source: HTMLElement,
    sourceLink: HTMLAnchorElement,
    search: ExtensionRecentSearch,
): HTMLElement {
    const card = source.cloneNode(true) as HTMLElement;
    const link = card.querySelector<HTMLAnchorElement>(RECENT_SEARCH_SELECTOR);
    const description = card.querySelector<HTMLElement>('[data-testid="recent-search-description"]');
    const alert = card.querySelector<HTMLButtonElement>(
        '[data-testid="create-alert-frequency-button"], #changeAlertFrequencyButton',
    );
    const sourceAlert = source.querySelector<HTMLButtonElement>(
        '[data-testid="create-alert-frequency-button"], #changeAlertFrequencyButton',
    );
    const title = search.title || getSearchTitle(sourceLink);

    card.dataset.edfRecentSearch = search.url;
    if (link) link.href = search.url;
    if (description) description.textContent = describeFilters(search);
    if (alert) bindRecentAlert(alert, search.url, title, sourceAlert ?? undefined);

    return markOwned(card, "recent-search");
}

async function renderRecentSearches(): Promise<void> {
    const searches = await getRecentSearches();
    const existing = new Set(
        [...document.querySelectorAll<HTMLElement>("[data-edf-recent-search]")]
            .map(card => card.dataset.edfRecentSearch)
            .filter((url): url is string => Boolean(url)),
    );
    const sources = [...document.querySelectorAll<HTMLAnchorElement>(RECENT_SEARCH_SELECTOR)];

    for (const sourceLink of sources) {
        const sourceCard = sourceLink.closest<HTMLElement>("article");
        const sourceAlert = sourceCard?.querySelector<HTMLButtonElement>(
            '[data-testid="create-alert-frequency-button"], #changeAlertFrequencyButton',
        );
        if (sourceAlert) {
            const url = sourceAlert.dataset.edfAlertSearchUrl ?? sourceLink.href;
            const title = sourceAlert.dataset.edfAlertSearchTitle ?? getSearchTitle(sourceLink);
            bindRecentAlert(sourceAlert, url, title);
        }
    }

    for (const search of searches) {
        if (existing.has(search.url)) continue;

        const sourceLink = sources.find(link => {
            const sourceUrl = new URL(link.href, window.location.origin);
            sourceUrl.searchParams.delete("lastsearchdate");
            sourceUrl.searchParams.delete("page");
            sourceUrl.searchParams.delete("pageNumber");
            sourceUrl.searchParams.sort();
            return sourceUrl.href === getRecentSearchBaseUrl(search);
        });
        const sourceCard = sourceLink?.closest<HTMLElement>("article");
        if (!sourceCard || !sourceLink) continue;

        sourceCard.after(createRecentSearchCard(sourceCard, sourceLink, search));
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
    bindPropertyAlertModal(context);
    context.signal.addEventListener("abort", () => {
        if (frame !== undefined) cancelAnimationFrame(frame);
    }, { once: true });
    render();
}
