import {
    addOrReplaceBlacklistEntry,
    removeBlacklistUrls,
} from "../../domain/blacklist/store";
import { getBlacklistListing, type BlacklistEntry } from "../../domain/matching";
import { createBlacklistCard } from "../../features/blacklist/card";
import {
    filterBlacklistEntries,
    sortBlacklistEntries,
    type BlacklistFilter,
    type BlacklistSort,
} from "../../features/blacklist/sort";
import { createCollectionController } from "../../shared/collections/controller";
import { createEmptyState } from "../../shared/ui/collection";
import { createCollectionFrame } from "../../shared/ui/collectionView";
import { renderSelectionControls, replaceSelection } from "../../shared/ui/selection";
import { createSortControl } from "../../shared/ui/sort";
import { createTabs } from "../../shared/ui/tabs";

interface BlacklistViewOptions {
    animate?: boolean;
    entries: readonly BlacklistEntry[];
    selectedUrls: Set<string>;
    signal: AbortSignal;
}

const retainedUnblacklistedEntries = new Map<string, BlacklistEntry>();

export function createBlacklistView(options: BlacklistViewOptions): HTMLElement {
    const { entries, selectedUrls, signal } = options;
    const active = entries.filter(entry => !entry.removedAt);
    const activeUrls = new Set(active.map(entry => getBlacklistListing(entry).url));
    const retained = [...retainedUnblacklistedEntries.values()]
        .filter(entry => !activeUrls.has(getBlacklistListing(entry).url));
    const items = [...active, ...retained];
    let animateNext = options.animate ?? true;
    const controls = document.createElement("div");
    const frame = createCollectionFrame({
        cardsClassName: "edf-popup-blacklist-grid edf-blacklist-card-grid",
        className: "edf-popup-content",
    });
    const controller = createCollectionController<BlacklistFilter, BlacklistEntry, BlacklistSort>({
        filter: (entry, filter) => filterBlacklistEntries([entry], filter).length > 0,
        getId: entry => getBlacklistListing(entry).url,
        initialFilter: "all",
        initialItems: items,
        initialSelection: [...selectedUrls],
        initialSort: "newest",
        sort: sortBlacklistEntries,
    });
    const sort = createSortControl({
        ariaLabel: "Sort blacklisted properties",
        onChange: () => {
            animateNext = true;
            controller.setSort(sort.value() as BlacklistSort);
        },
        options: [
            ["newest", "Newest"],
            ["oldest", "Oldest"],
            ["address", "Address"],
        ],
        signal,
    });
    const tabs = createTabs<BlacklistFilter>({
        active: "all",
        onChange: filter => {
            animateNext = true;
            controller.setFilter(filter);
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

        replaceSelection(selectedUrls, [...selection]);
        controls.className = "edf-page-actions";
        renderSelectionControls({
            buttonClassName: "edf-selection-action",
            clearLabel: "Restore selected",
            controls,
            onClear: ids => {
                void removeBlacklistUrls(ids).then(() => {
                    ids.forEach(url => {
                        const entry = items.find(candidate => getBlacklistListing(candidate).url === url);
                        if (entry) retainedUnblacklistedEntries.set(url, entry);
                    });
                    controller.clearSelection();
                });
            },
            onSelectionChange: ids => controller.replaceSelection(ids),
            selectedIds: [...selection],
            visibleIds: visible.map(entry => getBlacklistListing(entry).url),
        });
        frame.replaceCards(visible.map(entry => {
            const url = getBlacklistListing(entry).url;
            const retainedEntry = retainedUnblacklistedEntries.has(url);
            return createBlacklistCard(entry, {
                active: !retainedEntry,
                onSelectionChange: selected => {
                    if (selected !== controller.getSelection().has(url)) controller.toggleSelection(url);
                },
                onToggle: async () => {
                    if (retainedEntry) {
                        retainedUnblacklistedEntries.delete(url);
                        await addOrReplaceBlacklistEntry(getBlacklistListing(entry));
                    } else {
                        retainedUnblacklistedEntries.set(url, entry);
                        await removeBlacklistUrls(url);
                    }
                    render();
                },
                openLinksInNewTab: true,
                selected: selection.has(url),
            });
        }), animateNext);
        frame.setEmptyState(visible.length === 0 ? createEmptyState(
            items.length === 0 ? "No blacklisted properties" : "No matching properties",
            items.length === 0
                ? "Properties hidden from Domain results will appear here."
                : "Try another property category.",
        ) : undefined);
        animateNext = false;
    };

    frame.setToolbar([tabs, controls, sort.element]);
    controller.subscribe(render, signal);
    render();
    return frame.element;
}
