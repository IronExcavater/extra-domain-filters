import type { SavedSearch } from "../../domain/searches/savedSearches";
import { markOwned } from "../../shared/dom/ownership";
import { createSelectionCheckbox } from "../../shared/ui/selection";
import {
    createDeleteButton,
    createNotificationButton,
    createShareButton,
} from "./card/actions";
import {
    createCategory,
    createFeatureRow,
    createFilterChips,
    createTitle,
} from "./card/content";
import {
    getFilterSummary,
    getSearchUrl,
} from "./card/summary";
import type { SavedSearchCardOptions } from "./card/types";

export { openAlertModal } from "./card/modal";
export {
    createCategory,
    createFeatureRow,
    createFilterChips,
    createTitle,
} from "./card/content";
export {
    getFilterSummary,
    getSearchTitle,
    getSearchUrl,
} from "./card/summary";
export type { SavedSearchActions, SavedSearchCardOptions } from "./card/types";

function configureLink(
    link: HTMLAnchorElement,
    url: string,
    openInNewTab: boolean,
): void {
    link.href = url;
    if (!openInNewTab) return;

    link.target = "_blank";
    link.rel = "noreferrer";
}

export function createSavedSearchCard(
    search: SavedSearch,
    options: SavedSearchCardOptions,
): HTMLElement {
    const entry = document.createElement("article");
    const main = document.createElement("div");
    const titleLink = document.createElement("a");
    const headingRow = document.createElement("div");
    const actions = document.createElement("div");
    const view = document.createElement("a");
    const url = getSearchUrl(search);
    const summary = getFilterSummary(search);
    const chips = createFilterChips(summary.chips);
    const title = createTitle(search);

    entry.className = "edf-saved-search-card";
    entry.dataset.savedsearchId = search.id;
    entry.dataset.savedsearchTitle = search.title;
    entry.dataset.testid = "saved-searches__entry";
    main.className = "edf-saved-search-card-main";
    headingRow.className = "edf-saved-search-title-row";
    if (options.onSelectionChange) {
        headingRow.append(createSelectionCheckbox(
            options.selected ?? false,
            `Select ${search.title || "saved search"}`,
            options.onSelectionChange,
        ));
    }
    titleLink.className = "edf-saved-search-card-link";
    configureLink(titleLink, url.href, options.openLinksInNewTab ?? false);
    titleLink.append(title);
    headingRow.append(titleLink);
    main.append(createCategory(summary), headingRow, createFeatureRow(summary, false));
    if (chips) main.append(chips);

    actions.className = "edf-saved-search-card-actions";
    view.className = "edf-saved-search-action";
    view.dataset.testid = "saved-searches__view-properties";
    view.textContent = "View Properties";
    configureLink(view, url.href, options.openLinksInNewTab ?? false);
    actions.append(view, createShareButton(search, options.signal, options));

    entry.append(
        main,
        actions,
        createNotificationButton(search, options),
        createDeleteButton(search, options.signal, options),
    );

    return markOwned(entry, "saved-search-entry");
}
