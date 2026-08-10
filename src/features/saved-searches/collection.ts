import type { SavedSearch } from "../../domain/searches/savedSearches";
import { createCollectionController } from "../../shared/collections/controller";
import { createEmptyState } from "../../shared/ui/collection";
import { createCollectionFrame } from "../../shared/ui/collectionView";
import { renderSelectionControls, replaceSelection } from "../../shared/ui/selection";
import { createSortControl } from "../../shared/ui/sort";
import { createTabs } from "../../shared/ui/tabs";
import { createSavedSearchCard } from "./card";
import {
    getSavedSearchType,
    sortSavedSearches,
    type SavedSearchSort,
    type SavedSearchType,
} from "./sort";

export interface SavedSearchCollection {
    element: HTMLElement;
    replaceItems(searches: readonly SavedSearch[], animate?: boolean): void;
}

export interface SavedSearchCollectionOptions {
    animate?: boolean;
    cardsClassName: string;
    className?: string;
    density?: "comfortable" | "compact";
    emptyMessage?: string;
    items: readonly SavedSearch[];
    onNotify(message: string): void;
    onRemove(search: SavedSearch): Promise<void>;
    onSave(search: SavedSearch): Promise<void>;
    openLinksInNewTab?: boolean;
    selectedIds: Set<string>;
    signal: AbortSignal;
}

export function createSavedSearchCollection(
    options: SavedSearchCollectionOptions,
): SavedSearchCollection {
    let items = [...options.items];
    let animateNext = options.animate ?? false;
    let cardsController = new AbortController();
    const controls = document.createElement("div");
    const frame = createCollectionFrame({
        cardsClassName: options.cardsClassName,
        className: options.className,
    });
    const controller = createCollectionController<SavedSearchType, SavedSearch, SavedSearchSort>({
        filter: (search, type) => type === "all" || getSavedSearchType(search) === type,
        getId: search => search.id,
        initialFilter: "all",
        initialItems: items,
        initialSelection: [...options.selectedIds],
        initialSort: "newest",
        sort: sortSavedSearches,
    });
    const removeSearch = async (search: SavedSearch): Promise<void> => {
        await options.onRemove(search);
        options.selectedIds.delete(search.id);
        items = items.filter(candidate => candidate.id !== search.id);
        controller.replaceItems(items);
    };
    const saveAlert = async (search: SavedSearch): Promise<void> => {
        await options.onSave(search);
        items = items.map(candidate => candidate.id === search.id ? search : candidate);
        controller.replaceItems(items);
    };
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
        signal: options.signal,
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
        signal: options.signal,
    });
    const removeSelected = async (ids: readonly string[]): Promise<void> => {
        const selected = new Set(ids);
        const searches = items.filter(search => selected.has(search.id));
        for (const search of searches) await removeSearch(search);
        options.onNotify(searches.length === 1 ? "Saved search deleted" : "Saved searches deleted");
    };
    const render = (): void => {
        cardsController.abort();
        cardsController = new AbortController();
        const visible = controller.getVisibleItems();
        const selection = controller.getSelection();

        replaceSelection(options.selectedIds, [...selection]);
        controls.className = "edf-page-actions";
        renderSelectionControls({
            buttonClassName: "edf-selection-action",
            clearLabel: "Remove selected",
            controls,
            onClear: ids => void removeSelected(ids),
            onSelectionChange: ids => controller.replaceSelection(ids),
            selectedIds: [...selection],
            visibleIds: visible.map(search => search.id),
        });
        frame.replaceCards(visible.map(search => createSavedSearchCard(search, {
            density: options.density,
            onRemove: removeSearch,
            onSave: saveAlert,
            onNotify: options.onNotify,
            onSelectionChange: selected => {
                if (selected !== controller.getSelection().has(search.id)) {
                    controller.toggleSelection(search.id);
                }
            },
            openLinksInNewTab: options.openLinksInNewTab,
            selected: selection.has(search.id),
            signal: cardsController.signal,
        })), animateNext);
        frame.setEmptyState(visible.length === 0 ? createEmptyState(
            items.length === 0 ? "No saved searches yet" : "No matching saved searches",
            items.length === 0
                ? options.emptyMessage ?? "Save a search on domain.com.au to see it here."
                : "Try another search category.",
        ) : undefined);
        animateNext = false;
    };

    options.signal.addEventListener("abort", () => cardsController.abort(), { once: true });
    frame.setToolbar([tabs, controls, sort.element]);
    controller.subscribe(render, options.signal);
    render();

    return {
        element: frame.element,
        replaceItems: (searches, animate = false) => {
            items = [...searches];
            animateNext = animate;
            controller.replaceItems(items);
        },
    };
}
