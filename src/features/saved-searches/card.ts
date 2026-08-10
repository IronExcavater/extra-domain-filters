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
import { getFilterSummary, getSearchUrl } from "./card/summary";
import type { SavedSearchCardOptions } from "./card/types";

export {
    createCategory,
    createFeatureRow,
    createFilterChips,
    createTitle,
} from "./card/content";
export { getFilterSummary, getSearchTitle, getSearchUrl } from "./card/summary";
export type { SavedSearchActions, SavedSearchCardOptions } from "./card/types";

function configureLink(link: HTMLAnchorElement, url: string, openInNewTab: boolean): void {
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
    const primary = document.createElement("a");
    const main = document.createElement("div");
    const headingRow = document.createElement("div");
    const actions = document.createElement("div");
    const url = getSearchUrl(search);
    const summary = getFilterSummary(search);
    const chips = createFilterChips(summary.chips);

    entry.className = "edf-saved-search-card";
    entry.dataset.density = options.density ?? "comfortable";
    entry.dataset.savedsearchId = search.id;
    entry.dataset.savedsearchTitle = search.title;
    entry.dataset.testid = "saved-searches__entry";
    primary.className = "edf-saved-search-primary-link";
    primary.ariaLabel = `View properties for ${search.title || "saved search"}`;
    configureLink(primary, url.href, options.openLinksInNewTab ?? false);
    main.className = "edf-saved-search-card-main";
    headingRow.className = "edf-saved-search-title-row";
    if (options.onSelectionChange) {
        headingRow.append(createSelectionCheckbox(
            options.selected ?? false,
            `Select ${search.title || "saved search"}`,
            options.onSelectionChange,
        ));
    }
    headingRow.append(createTitle(search));
    main.append(createCategory(summary), headingRow, createFeatureRow(summary, false));
    if (chips) main.append(chips);
    actions.className = "edf-saved-search-card-actions";
    actions.append(
        createNotificationButton(search, options.signal, options),
        createShareButton(search, options.signal, options),
        createDeleteButton(search, options.signal, options),
    );
    entry.append(primary, main, actions);
    return markOwned(entry, "saved-search-entry");
}
