import {
    removeSavedSearch,
    type SavedSearch,
} from "../../domain/searches/savedSearches";
import { createSavedSearchCard } from "../../features/saved-searches/card";
import {
    getSavedSearchType,
    sortSavedSearches,
    type SavedSearchSort,
    type SavedSearchType,
} from "../../features/saved-searches/sort";
import { createCollectionController } from "../../shared/collections/controller";
import { createEmptyState } from "../../shared/ui/collection";
import { createCollectionFrame } from "../../shared/ui/collectionView";
import { renderSelectionControls, replaceSelection } from "../../shared/ui/selection";
import { createSortControl } from "../../shared/ui/sort";
import { createTabs } from "../../shared/ui/tabs";
import { showPopupToast } from "../toast";

export function createSavedSearchesView(
    searches: readonly SavedSearch[],
    selectedIds: Set<string>,
    signal: AbortSignal,
    animate = true,
): HTMLElement {
    let items = [...searches];
    let animateNext = animate;
    const controls = document.createElement("div");
    const frame = createCollectionFrame({
        cardsClassName: "edf-popup-search-grid",
        className: "edf-popup-content",
    });
    const controller = createCollectionController<SavedSearchType, SavedSearch, SavedSearchSort>({
        filter: (search, type) => type === "all" || getSavedSearchType(search) === type,
        getId: search => search.id,
        initialFilter: "all",
        initialItems: items,
        initialSelection: [...selectedIds],
        initialSort: "newest",
        sort: sortSavedSearches,
    });
    const sort = createSortControl({
        ariaLabel: "Sort saved searches",
        onChange: () => {
            animateNext = true;
            controller.setSort(sort.value() as SavedSearchSort);
        },
        options: [
            ["newest", "Newest"],
            ["oldest", "Oldest"],
            ["title", "Title"],
        ],
        signal,
    });
    const tabs = createTabs<SavedSearchType>({
        active: "all",
        onChange: type => {
            animateNext = true;
            controller.setFilter(type);
        },
        options: [
            { label: "All", value: "all" },
            { label: "Buy", value: "buy" },
            { label: "Rent", value: "rent" },
        ],
        signal,
    });
    const render = (): void => {
        const visible = controller.getVisibleItems();
        const selection = controller.getSelection();

        replaceSelection(selectedIds, [...selection]);
        controls.className = "edf-page-actions";
        renderSelectionControls({
            buttonClassName: "edf-selection-action",
            clearLabel: "Remove selected",
            controls,
            onClear: ids => {
                const removed = new Set(ids);
                items = items.filter(search => !removed.has(search.id));
                controller.replaceItems(items);
                void Promise.all(ids.map(removeSavedSearch));
            },
            onSelectionChange: ids => controller.replaceSelection(ids),
            selectedIds: [...selection],
            visibleIds: visible.map(search => search.id),
        });
        frame.replaceCards(visible.map(search => createSavedSearchCard(search, {
            compactAlertModal: true,
            openLinksInNewTab: true,
            onNotify: showPopupToast,
            onSelectionChange: selected => {
                if (selected !== controller.getSelection().has(search.id)) {
                    controller.toggleSelection(search.id);
                }
            },
            selected: selection.has(search.id),
            signal,
        })), animateNext);
        frame.setEmptyState(visible.length === 0 ? createEmptyState(
            items.length === 0 ? "No saved searches yet" : "No matching saved searches",
            items.length === 0
                ? "Save a search on domain.com.au to see it here."
                : "Try another search category.",
        ) : undefined);
        animateNext = false;
    };

    frame.setToolbar([tabs, controls, sort.element]);
    controller.subscribe(render, signal);
    render();
    return frame.element;
}
