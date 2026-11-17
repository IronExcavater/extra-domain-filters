import { createSvgIcon, type IconRenderer } from "./elements";

export function createCollectionHeader(
    titleText: string,
    descriptionText: string,
): HTMLElement {
    const header = document.createElement("div");
    const title = document.createElement("h1");
    const description = document.createElement("p");

    header.className = "edf-collection-header";
    title.className = "edf-collection-title";
    title.textContent = titleText;
    description.className = "edf-collection-description";
    description.textContent = descriptionText;
    header.append(title, description);

    return header;
}

export interface EmptyStateAction {
    href: string;
    label: string;
    /** The popup opens Domain in a new tab. */
    newTab?: boolean;
}

export type SearchMode = "buy" | "new homes" | "rent";

const SEARCH_URLS: Record<SearchMode, string> = {
    buy: "https://www.domain.com.au/",
    "new homes": "https://www.domain.com.au/new-homes",
    rent: "https://www.domain.com.au/?mode=rent",
};

/** Domain's own empty-state button ("Search for properties"), aimed at the mode in view. */
export function createSearchAction(mode: SearchMode = "buy", newTab = false): EmptyStateAction {
    const label = { buy: "Search for properties", "new homes": "Search new homes", rent: "Search rentals" }[mode];
    return { href: SEARCH_URLS[mode], label, newTab };
}

/**
 * The one empty state for shortlist, blacklist and saved searches, in the popup and on
 * Domain: icon, what's missing, how to fill it, and Domain's search button.
 */
export function createEmptyState(
    titleText: string,
    descriptionText: string,
    icon?: IconRenderer,
    action?: EmptyStateAction,
): HTMLElement {
    const empty = document.createElement("div");
    const title = document.createElement("p");
    const description = document.createElement("p");

    empty.className = "edf-empty-state";
    if (icon) empty.append(createSvgIcon(icon, "edf-empty-state-icon"));
    title.className = "edf-empty-state-title";
    title.textContent = titleText;
    description.className = "edf-empty-state-description";
    description.textContent = descriptionText;
    empty.append(title, description);
    if (action) {
        const link = document.createElement("a");
        link.className = "edf-empty-state-action";
        link.href = action.href;
        link.textContent = action.label;
        if (action.newTab) {
            link.target = "_blank";
            link.rel = "noopener noreferrer";
        }
        empty.append(link);
    }

    return empty;
}
