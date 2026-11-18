import { createCollectionController } from "../../collections/controller";
import type { SavedSearch } from "../../domain/searches/savedSearches";
import { createEmptyState, createSearchAction } from "../../ui/collection";
import { createCollectionFrame } from "../../ui/collectionView";
import { replaceWithSavedSearchBellIcon } from "../../ui/icons";
import {
    renderSelectionControls,
    replaceSelection,
    setSelectionCheckboxState,
} from "../../ui/selection";
import { createSortControl } from "../../ui/sort";
import { createTabs } from "../../ui/tabs";
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
    items: readonly SavedSearch[];
    onNotify(message: string): void;
    onRemove(search: SavedSearch): Promise<void>;
    onSave(search: SavedSearch): Promise<void>;
    openLinksInNewTab?: boolean;
    selectedIds: Set<string>;
    title?: string;
    signal: AbortSignal;
}

// Worded for the tab in view, like the shortlist's.
const EMPTY_COPY: Record<SavedSearchType, { description: string; title: string }> = {
    all: {
        title: "No saved searches yet",
        description: "Save a search on Domain to get alerts for new listings and find it here.",
    },
    buy: {
        title: "No saved searches for buying",
        description: "Save a search for properties for sale and it will show up here.",
    },
    rent: {
        title: "No saved rental searches",
        description: "Save a search for rentals and it will show up here.",
    },
};

export function createSavedSearchCollection(
    options: SavedSearchCollectionOptions,
): SavedSearchCollection {
    const selectionTransitionMs = 160;
    let items = [...options.items];
    let animateNext = options.animate ?? false;
    let activeType: SavedSearchType = "all";
    let cardsController = new AbortController();
    let selectionCommitTimer: number | undefined;
    const controls = document.createElement("div");
    const frame = createCollectionFrame({
        cardsClassName: options.cardsClassName,
        className: options.className,
        title: options.title,
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
            activeType = type;
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
        const visibleIds = visible.map(search => search.id);
        // The toolbar follows a selection straight away; the cards are rebuilt (by the
        // controller) once their checkboxes have finished animating.
        const renderControls = (selectedIds: readonly string[]): void => renderSelectionControls({
            buttonClassName: "edf-selection-action",
            clearLabel: "Remove selected",
            controls,
            onClear: ids => void removeSelected(ids),
            onSelectionChange: ids => {
                const next = new Set(ids);
                for (const card of frame.cards.querySelectorAll<HTMLElement>("[data-savedsearch-id]")) {
                    const input = card.querySelector<HTMLInputElement>(".edf-selection-checkbox input");
                    if (input) setSelectionCheckboxState(
                        input,
                        next.has(card.dataset.savedsearchId ?? ""),
                    );
                }
                renderControls(ids);
                if (selectionCommitTimer !== undefined) window.clearTimeout(selectionCommitTimer);
                selectionCommitTimer = window.setTimeout(() => {
                    selectionCommitTimer = undefined;
                    controller.replaceSelection(ids);
                }, selectionTransitionMs);
            },
            selectedIds,
            visibleIds,
        });
        renderControls([...selection]);
        frame.replaceCards(visible.map(search => createSavedSearchCard(search, {
            density: options.density,
            onRemove: removeSearch,
            onSave: saveAlert,
            onNotify: options.onNotify,
            onSelectionChange: selected => {
                if (selected === controller.getSelection().has(search.id)) return;
                controller.toggleSelection(search.id);
            },
            openLinksInNewTab: options.openLinksInNewTab,
            selected: selection.has(search.id),
            signal: cardsController.signal,
        })), animateNext);
        const empty = EMPTY_COPY[activeType];
        frame.setEmptyState(visible.length === 0 ? createEmptyState(
            empty.title,
            empty.description,
            replaceWithSavedSearchBellIcon,
            createSearchAction(activeType === "rent" ? "rent" : "buy", options.openLinksInNewTab),
        ) : undefined);
        animateNext = false;
    };

    options.signal.addEventListener("abort", () => {
        cardsController.abort();
        if (selectionCommitTimer !== undefined) window.clearTimeout(selectionCommitTimer);
    }, { once: true });
    frame.setTabs(tabs);
    frame.setToolbar([controls, sort.element]);
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
