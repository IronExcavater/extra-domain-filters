import {
    addOrReplaceBlacklistEntry,
    removeBlacklistUrls,
} from "../../domain/blacklist/store";
import { getBlacklistListing, type BlacklistEntry } from "../../domain/matching";
import { createBlacklistCard } from "../../features/blacklist/card";
import {
    sortBlacklistEntries,
    filterBlacklistEntries,
    type BlacklistFilter,
    type BlacklistSort,
} from "../../features/blacklist/sort";
import { createEmptyState } from "../../shared/ui/collection";
import { createButton } from "../../shared/ui/elements";
import { setSelectionCheckboxState } from "../../shared/ui/selection";
import { createSortControl } from "../../shared/ui/sort";
import { createTabs } from "../../shared/ui/tabs";

interface BlacklistViewOptions {
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
    const sessionEntries = [...active, ...retained];
    const content = document.createElement("section");
    const toolbar = document.createElement("div");
    const grid = document.createElement("div");
    const controls = document.createElement("div");
    const select = createButton("", "edf-selection-action");
    const restore = createButton("Restore selected", "edf-selection-action");
    let filter: BlacklistFilter = "all";
    let renderCards = (): void => undefined;
    const sort = createSortControl({
        ariaLabel: "Sort blacklisted properties",
        onChange: () => renderCards(),
        options: [
            ["newest", "Newest"],
            ["oldest", "Oldest"],
            ["address", "Address"],
        ],
        signal,
    });

    for (const url of selectedUrls) {
        if (!sessionEntries.some(entry => getBlacklistListing(entry).url === url)) selectedUrls.delete(url);
    }
    content.className = "edf-popup-content";
    if (sessionEntries.length === 0) {
        content.append(createEmptyState(
            "No blacklisted properties",
            "Properties hidden from Domain results will appear here.",
        ));
        return content;
    }

    toolbar.className = "edf-collection-toolbar";
    controls.className = "edf-page-actions";
    grid.className = "edf-popup-blacklist-grid edf-blacklist-card-grid";
    const visibleEntries = (): BlacklistEntry[] => filterBlacklistEntries(sessionEntries, filter);
    const syncCheckboxes = (): void => {
        for (const card of grid.querySelectorAll<HTMLElement>("[data-blacklist-url]")) {
            const input = card.querySelector<HTMLInputElement>(".edf-selection-checkbox input");
            if (input) setSelectionCheckboxState(input, selectedUrls.has(card.dataset.blacklistUrl ?? ""));
        }
    };
    const renderControls = (): void => {
        const visible = visibleEntries();
        const allSelected = visible.every(entry =>
            selectedUrls.has(getBlacklistListing(entry).url)
        );
        select.textContent = allSelected ? "Deselect all" : "Select all";
        restore.hidden = selectedUrls.size === 0;
    };
    renderCards = () => {
        grid.replaceChildren(...sortBlacklistEntries(visibleEntries(), sort.value() as BlacklistSort).map(entry => {
            const url = getBlacklistListing(entry).url;
            const retained = retainedUnblacklistedEntries.has(url);
            return createBlacklistCard(entry, {
                active: !retained,
                onSelectionChange: selected => {
                    if (selected) selectedUrls.add(url);
                    else selectedUrls.delete(url);
                    renderControls();
                },
                onToggle: async () => {
                    if (retained) {
                        retainedUnblacklistedEntries.delete(url);
                        await addOrReplaceBlacklistEntry(getBlacklistListing(entry));
                    } else {
                        retainedUnblacklistedEntries.set(url, entry);
                        await removeBlacklistUrls(url);
                    }
                    renderCards();
                    renderControls();
                },
                openLinksInNewTab: true,
                selected: selectedUrls.has(url),
            });
        }));
    };
    select.addEventListener("click", () => {
        const visible = visibleEntries();
        const allSelected = visible.every(entry =>
            selectedUrls.has(getBlacklistListing(entry).url)
        );
        selectedUrls.clear();
        if (!allSelected) {
            visible.forEach(entry => selectedUrls.add(getBlacklistListing(entry).url));
        }
        syncCheckboxes();
        renderControls();
    });
    restore.addEventListener("click", async () => {
        await removeBlacklistUrls([...selectedUrls]);
        selectedUrls.forEach(url => {
            const entry = sessionEntries.find(candidate => getBlacklistListing(candidate).url === url);
            if (entry) retainedUnblacklistedEntries.set(url, entry);
        });
        selectedUrls.clear();
        renderCards();
        renderControls();
    });

    controls.append(select, restore);
    toolbar.append(createTabs({
        active: filter,
        onChange: next => {
            filter = next;
            renderCards();
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
    renderCards();
    renderControls();

    return content;
}
