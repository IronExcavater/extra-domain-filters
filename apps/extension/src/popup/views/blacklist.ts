import { createCollectionController } from "../../collections/controller";
import {
    addOrReplaceBlacklistEntry,
    removeBlacklistUrls,
} from "../../domain/blacklist/store";
import { getBlacklistListing, type BlacklistEntry } from "../../domain/matching";
import { createBlacklistCard } from "../../features/blacklist/card";
import {
    filterBlacklistEntries,
    sortBlacklistEntries,
    updateStableNewestOrder,
    type BlacklistFilter,
    type BlacklistSort,
} from "../../features/blacklist/sort";
import { createEmptyState } from "../../ui/collection";
import { createCollectionFrame } from "../../ui/collectionView";
import { replaceWithBinIcon } from "../../ui/icons";
import {
    renderSelectionControls,
    replaceSelection,
    setSelectionCheckboxState,
} from "../../ui/selection";
import { createSortControl } from "../../ui/sort";
import { createTabs } from "../../ui/tabs";

interface BlacklistViewOptions {
    animate?: boolean;
    entries: readonly BlacklistEntry[];
    selectedUrls: Set<string>;
    signal: AbortSignal;
}

const retainedUnblacklistedEntries = new Map<string, BlacklistEntry>();
const stableNewestOrder = new Map<string, number>();
const SELECTION_TRANSITION_MS = 160;

export function createBlacklistView(options: BlacklistViewOptions): HTMLElement {
    const { entries, selectedUrls, signal } = options;
    const active = entries.filter(entry => !entry.removedAt);
    const activeUrls = new Set(active.map(entry => getBlacklistListing(entry).url));
    const retained = [...retainedUnblacklistedEntries.values()]
        .filter(entry => !activeUrls.has(getBlacklistListing(entry).url));
    const items = [...active, ...retained];
    updateStableNewestOrder(stableNewestOrder, items);
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
        sort: (candidates, sort) => sortBlacklistEntries(candidates, sort, stableNewestOrder),
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
            onSelectionChange: ids => {
                const next = new Set(ids);
                for (const card of frame.cards.querySelectorAll<HTMLElement>("[data-blacklist-url]")) {
                    const input = card.querySelector<HTMLInputElement>(".edf-selection-checkbox input");
                    if (input) setSelectionCheckboxState(input, next.has(card.dataset.blacklistUrl ?? ""));
                }
                window.setTimeout(() => controller.replaceSelection(ids), SELECTION_TRANSITION_MS);
            },
            selectedIds: [...selection],
            visibleIds: visible.map(entry => getBlacklistListing(entry).url),
        });
        frame.replaceCards(visible.map(entry => {
            const url = getBlacklistListing(entry).url;
            const retainedEntry = retainedUnblacklistedEntries.has(url);
            return createBlacklistCard(entry, {
                active: !retainedEntry,
                onSelectionChange: selected => {
                    if (selected === controller.getSelection().has(url)) return;
                    controller.toggleSelection(url);
                },
                onToggle: async (_action, nextActive) => {
                    // Use the requested destination state explicitly. During Undo the original
                    // button has already been detached by the popup render, so its DOM state is
                    // not a reliable source of intent.
                    if (nextActive) {
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
                signal,
            });
        }), animateNext);
        frame.setEmptyState(visible.length === 0 ? createEmptyState(
            items.length === 0 ? "No blacklisted properties" : "No matching properties",
            items.length === 0
                ? "Properties hidden from Domain results will appear here."
                : "Try another property category.",
            replaceWithBinIcon,
        ) : undefined);
        animateNext = false;
    };

    frame.setToolbar([tabs, controls, sort.element]);
    controller.subscribe(render, signal);
    render();
    return frame.element;
}
