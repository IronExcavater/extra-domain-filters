import { createCollectionController } from "../../collections/controller";
import {
    addOrReplaceBlacklistEntry,
    removeBlacklistUrls,
} from "../../domain/blacklist/store";
import { getBlacklistListing, type BlacklistEntry } from "../../domain/matching";
import { isProfileEntry } from "../../domain/blacklist/profiles";
import { createBlacklistCard } from "../../features/blacklist/card";
import {
    createProfileCard,
    getProfileEntries,
    PROFILE_EMPTY_COPY,
    PROPERTIES_EMPTY_COPY,
} from "../../features/blacklist/profiles";
import {
    filterBlacklistEntries,
    sortBlacklistEntries,
    updateStableNewestOrder,
    type BlacklistFilter,
    type BlacklistSort,
} from "../../features/blacklist/sort";
import { createEmptyState, createSearchAction } from "../../ui/collection";
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

type BlacklistScope = "agency" | "agent" | "properties";

const retainedUnblacklistedEntries = new Map<string, BlacklistEntry>();
// The scope survives re-renders (e.g. after showing an agency again).
let activeScope: BlacklistScope = "properties";
const stableNewestOrder = new Map<string, number>();
const SELECTION_TRANSITION_MS = 160;

export function createBlacklistView(options: BlacklistViewOptions): HTMLElement {
    const { entries, selectedUrls, signal } = options;
    const active = entries.filter(entry => !entry.removedAt && !isProfileEntry(entry));
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
        title: "Blacklist",
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
    const profiles = { agency: getProfileEntries(entries, "agency"), agent: getProfileEntries(entries, "agent") };
    const profileList = document.createElement("div");
    profileList.className = "edf-profile-grid edf-popup-profile-grid";
    frame.cards.after(profileList);
    const tabs = createTabs<BlacklistScope>({
        active: activeScope,
        indicatorKey: "popup-blacklist-scope",
        onChange: scope => {
            activeScope = scope;
            animateNext = true;
            renderScope();
        },
        options: [
            { label: "Properties", value: "properties" },
            { label: "Agencies", value: "agency" },
            { label: "Agents", value: "agent" },
        ],
        signal,
    });
    const renderProfiles = (scope: Exclude<BlacklistScope, "properties">): void => {
        const list = profiles[scope];
        profileList.replaceChildren(...(list.length > 0
            ? list.map(profile => createProfileCard(profile, { openInNewTab: true, toastScope: "popup" }))
            : [createEmptyState(
                PROFILE_EMPTY_COPY[scope].title,
                PROFILE_EMPTY_COPY[scope].description,
                replaceWithBinIcon,
                createSearchAction("buy", true),
            )]));
        if (animateNext) {
            profileList.removeAttribute("data-animate");
            void profileList.offsetWidth;
            profileList.dataset.animate = "true";
        }
        animateNext = false;
    };
    const renderScope = (): void => {
        const scope = activeScope;
        frame.setToolbar(scope === "properties" ? [controls, sort.element] : []);
        frame.element.dataset.scope = scope;
        profileList.hidden = scope === "properties";
        if (scope === "properties") {
            render();
            return;
        }
        frame.setEmptyState(undefined);
        frame.cards.hidden = true;
        renderProfiles(scope);
    };
    const render = (): void => {
        if (activeScope !== "properties") return;
        const visible = controller.getVisibleItems();
        const selection = controller.getSelection();

        replaceSelection(selectedUrls, [...selection]);
        controls.className = "edf-page-actions";
        renderSelectionControls({
            buttonClassName: "edf-selection-action",
            clearLabel: "Unblacklist",
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
            PROPERTIES_EMPTY_COPY.title,
            PROPERTIES_EMPTY_COPY.description,
            replaceWithBinIcon,
            createSearchAction("buy", true),
        ) : undefined);
        animateNext = false;
    };

    controls.className = "edf-page-actions";
    frame.setTabs(tabs);
    controller.subscribe(render, signal);
    renderScope();
    return frame.element;
}
