import {
    removeSavedSearch,
    type SavedSearch,
} from "../../domain/searches/savedSearches";
import { createSavedSearchCard } from "../../features/saved-searches/card";
import {
    sortSavedSearches,
    type SavedSearchSort,
    getSavedSearchType,
    type SavedSearchType,
} from "../../features/saved-searches/sort";
import { createEmptyState } from "../../shared/ui/collection";
import { renderSelectionControls, replaceSelection, setSelectionCheckboxState } from "../../shared/ui/selection";
import { createSortControl } from "../../shared/ui/sort";
import { createTabs } from "../../shared/ui/tabs";
import { showPopupToast } from "../toast";

export function createSavedSearchesView(
    searches: readonly SavedSearch[],
    selectedIds: Set<string>,
    signal: AbortSignal,
): HTMLElement {
    const content = document.createElement("section");
    const toolbar = document.createElement("div");
    const grid = document.createElement("div");
    const controls = document.createElement("div");
    let searchType: SavedSearchType = "all";
    let renderGrid = (): void => undefined;
    const sort = createSortControl({
        ariaLabel: "Sort saved searches",
        onChange: () => renderGrid(),
        options: [
            ["newest", "Newest"],
            ["oldest", "Oldest"],
            ["title", "Title"],
        ],
        signal,
    });

    content.className = "edf-popup-content";
    if (searches.length === 0) {
        content.append(createEmptyState(
            "No saved searches yet",
            "Save a search on domain.com.au to see it here.",
        ));
        return content;
    }

    toolbar.className = "edf-collection-toolbar";
    controls.className = "edf-page-actions";
    grid.className = "edf-popup-search-grid";
    const syncCheckboxes = (): void => {
        for (const card of grid.querySelectorAll<HTMLElement>("[data-savedsearch-id]")) {
            const input = card.querySelector<HTMLInputElement>(".edf-selection-checkbox input");
            if (input) setSelectionCheckboxState(input, selectedIds.has(card.dataset.savedsearchId ?? ""));
        }
    };
    const renderControls = (): void => {
        renderSelectionControls({
            buttonClassName: "edf-selection-action",
            clearLabel: "Remove selected",
            controls,
            onClear: ids => {
                void Promise.all(ids.map(removeSavedSearch));
                replaceSelection(selectedIds, []);
                renderGrid();
                renderControls();
            },
            onSelectionChange: ids => {
                replaceSelection(selectedIds, ids);
                syncCheckboxes();
                renderControls();
            },
            selectedIds: [...selectedIds],
            visibleIds: searches
                .filter(search => searchType === "all" || getSavedSearchType(search) === searchType)
                .map(search => search.id),
        });
    };
    renderGrid = () => {
        const visible = searches.filter(search =>
            searchType === "all" || getSavedSearchType(search) === searchType,
        );
        grid.replaceChildren(...sortSavedSearches(visible, sort.value() as SavedSearchSort).map(search =>
            createSavedSearchCard(search, {
                compactAlertModal: true,
                openLinksInNewTab: true,
                onNotify: showPopupToast,
                onSelectionChange: selected => {
                    if (selected) selectedIds.add(search.id);
                    else selectedIds.delete(search.id);
                    renderControls();
                },
                selected: selectedIds.has(search.id),
                signal,
            })
        ));
    };
    toolbar.append(createTabs({
        active: searchType,
        onChange: type => {
            searchType = type;
            renderGrid();
            renderControls();
        },
        options: [
            { label: "All", value: "all" },
            { label: "Buy", value: "buy" },
            { label: "Rent", value: "rent" },
        ],
        signal,
    }), controls, sort.element);
    content.append(toolbar, grid);
    renderGrid();
    renderControls();

    return content;
}
