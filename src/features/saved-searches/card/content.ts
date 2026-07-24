import type { SavedSearch } from "../../../domain/searches/savedSearches";
import { createSvgIcon } from "../../../shared/ui/elements";
import {
    replaceWithBathIcon,
    replaceWithBedIcon,
    replaceWithParkingIcon,
} from "../../../shared/ui/icons";
import {
    getSearchTitle,
    type SearchFilterSummary,
} from "./summary";

function createFeature(
    label: string,
    value: string,
    icon: (target: SVGElement) => void,
): HTMLElement {
    const item = document.createElement("span");
    const text = document.createElement("span");

    item.className = "edf-saved-search-feature";
    item.dataset.testid = "property-features-feature";
    item.ariaLabel = `${value} ${label}`;
    text.className = "edf-saved-search-feature-text";
    text.textContent = value;
    item.append(createSvgIcon(icon), text);

    return item;
}

export function createFeatureRow(
    summary: SearchFilterSummary,
    showTypesSeparator = true,
): HTMLElement {
    const row = document.createElement("div");
    const features = document.createElement("div");

    row.className = "edf-saved-search-description";
    row.dataset.testid = "saved-searches__entry--description";
    features.className = "edf-saved-search-features";
    features.dataset.testid = "property-features-wrapper";
    features.append(
        createFeature("Beds", summary.features.bedrooms, replaceWithBedIcon),
        createFeature("Baths", summary.features.bathrooms, replaceWithBathIcon),
        createFeature("Parking", summary.features.parking, replaceWithParkingIcon),
    );
    if (summary.inlineDetails.length > 0) {
        const details = document.createElement("span");
        details.className = "edf-saved-search-inline-details";
        details.textContent = `${showTypesSeparator ? "· " : ""}${summary.inlineDetails.join(", ")}`;
        features.append(details);
    }
    row.append(features);

    return row;
}

export function createCategory(summary: SearchFilterSummary): HTMLHeadingElement {
    const category = document.createElement("h3");

    category.className = "edf-saved-search-category";
    category.dataset.testid = "saved-searches__entry--category";
    category.textContent = summary.categoryDetail
        ? `${summary.categoryKind} ${summary.categoryDetail}`
        : summary.categoryKind;

    return category;
}

export function createTitle(search: SavedSearch): HTMLElement {
    const wrapper = document.createElement("span");
    const title = document.createElement("h2");

    wrapper.className = "edf-saved-search-title-content";
    title.className = "edf-saved-search-title";
    title.dataset.testid = "saved-searches__entry--title";
    title.textContent = getSearchTitle(search);

    wrapper.append(title);
    if (search.newListingCount !== undefined) {
        const count = document.createElement("span");
        count.className = "edf-saved-search-new-count";
        count.textContent = `${search.newListingCount.toLocaleString("en-AU")} new`;
        wrapper.append(count);
    }

    return wrapper;
}

export function createFilterChips(chips: readonly string[]): HTMLElement | undefined {
    if (chips.length === 0) return undefined;

    const row = document.createElement("div");
    row.className = "edf-saved-search-filter-chips";
    row.append(...chips.map(chip => {
        const element = document.createElement("span");
        element.className = "edf-saved-search-filter-chip";
        element.textContent = chip;
        return element;
    }));

    return row;
}
