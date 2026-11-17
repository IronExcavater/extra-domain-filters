import { enableMasonry } from "../ui/masonry";
import { markOwned } from "../dom/ownership";
import {
    addOrReplaceBlacklistEntry,
    getBlacklist,
    removeBlacklistUrls,
} from "../domain/blacklist/store";
import {
    getBlacklistListing,
    type BlacklistEntry,
} from "../domain/matching";
import { isProfileEntry, type ProfileKind } from "../domain/blacklist/profiles";
import { createBlacklistCard } from "../features/blacklist/card";
import {
    createProfileCard,
    getProfileEntries,
    PROFILE_EMPTY_COPY,
    PROPERTIES_EMPTY_COPY,
} from "../features/blacklist/profiles";
import {
    sortBlacklistEntries,
    updateStableNewestOrder,
    type BlacklistSort,
} from "../features/blacklist/sort";
import { enableStickyHeader } from "../features/navigation";
import {
    getPageActions,
    installSortControl,
    LISTING_CARD_SELECTOR,
    overridePageTitle,
    keepListingsPageMounted,
    setListingsSubtitle,
    replaceUserListingTabs,
    restorePageActions,
} from "../features/user-listings/page";
import { PageMount } from "../platform/router";
import { onStorageChange } from "../platform/storage";
import { createEmptyState, createSearchAction } from "../ui/collection";
import { replaceWithBinIcon } from "../ui/icons";
import {
    renderSelectionControls,
    replaceSelection,
    setSelectionCheckboxState,
} from "../ui/selection";

const selectedUrls = new Set<string>();
const retainedUnblacklistedEntries = new Map<string, BlacklistEntry>();
type BlacklistScope = "properties" | ProfileKind;

// The tab survives re-renders and remounts.
let scope: BlacklistScope = "properties";
let listingSort: BlacklistSort = "newest";
const PROFILES_TEST_ID = "extra-domain-filters-blacklist-profiles";
const SUBTITLES: Record<BlacklistScope, string> = {
    properties: "Blacklisted properties are hidden from your Domain searches.",
    agency: "Every listing from these agencies is hidden from your Domain searches.",
    agent: "Every listing from these agents is hidden from your Domain searches.",
};
const stableNewestOrder = new Map<string, number>();

function getRowVersion(entry: BlacklistEntry): string {
    return JSON.stringify({
        addedAt: entry.addedAt,
        listing: getBlacklistListing(entry),
    });
}

function installList(container: HTMLElement): { list: HTMLElement; restore: () => void } {
    const existing = container.querySelector<HTMLElement>(
        '[data-testid="extra-domain-filters-blacklist-list"]',
    );
    if (existing) return { list: existing, restore: () => undefined };

    const nativeList = container
        .querySelector(LISTING_CARD_SELECTOR)
        ?.parentElement;
    const list = document.createElement("div");

    list.className = "edf-blacklist-card-grid edf-blacklist-page-grid";
    list.dataset.testid = "extra-domain-filters-blacklist-list";
    markOwned(list, "blacklist-list");
    enableMasonry(list);
    if (nativeList instanceof HTMLElement) {
        const parent = nativeList.parentNode;
        const nextSibling = nativeList.nextSibling;

        nativeList.remove();
        if (nextSibling) parent?.insertBefore(list, nextSibling);
        else parent?.append(list);

        return {
            list,
            restore: () => {
                list.remove();
                if (nextSibling?.parentNode === parent) parent?.insertBefore(nativeList, nextSibling);
                else parent?.append(nativeList);
            },
        };
    }

    const message = container.querySelector('[data-testid="shortlist__message_wrapper"]');
    if (message) message.after(list);
    else container.append(list);

    return { list, restore: () => list.remove() };
}

function createRow(
    entry: BlacklistEntry,
    renderRows: () => void,
    renderControls: () => void,
): HTMLElement {
    const listing = getBlacklistListing(entry);
    const retained = retainedUnblacklistedEntries.has(listing.url);
    const card = createBlacklistCard(entry, {
        active: !retained,
        onToggle: async () => {
            if (retainedUnblacklistedEntries.has(listing.url)) {
                retainedUnblacklistedEntries.delete(listing.url);
                await addOrReplaceBlacklistEntry(listing);
            } else {
                retainedUnblacklistedEntries.set(listing.url, entry);
                await removeBlacklistUrls(listing.url);
            }
            renderRows();
        },
        onSelectionChange: checked => {
            if (checked) selectedUrls.add(listing.url);
            else selectedUrls.delete(listing.url);
            renderControls();
        },
        openLinksInNewTab: false,
        selected: selectedUrls.has(listing.url),
    });

    card.dataset.edfBlacklistVersion = getRowVersion(entry);
    card.dataset.edfBlacklistActive = String(!retained);

    return card;
}

function reconcileRows(
    list: HTMLElement,
    entries: readonly BlacklistEntry[],
    renderRows: () => void,
    renderControls: () => void,
): void {
    const existing = new Map(
        [...list.querySelectorAll<HTMLElement>("[data-blacklist-url]")]
            .map(card => [card.dataset.blacklistUrl, card] as const)
            .filter((value): value is [string, HTMLElement] => value[0] !== undefined),
    );
    const cards = entries.map(entry => {
        const url = getBlacklistListing(entry).url;
        const card = existing.get(url);

        const active = !retainedUnblacklistedEntries.has(url);
        if (
            card?.dataset.edfBlacklistVersion === getRowVersion(entry) &&
            card.dataset.edfBlacklistActive === String(active)
        ) {
            const checkbox = card.querySelector<HTMLInputElement>(".edf-selection-checkbox input");
            if (checkbox) setSelectionCheckboxState(checkbox, selectedUrls.has(url));

            return card;
        }

        return createRow(entry, renderRows, renderControls);
    });

    list.replaceChildren(...cards);
}

/** Agencies or agents: their cards, or the tab's empty state, in place of the listings. */
function renderProfiles(container: HTMLElement, list: HTMLElement, blacklist: readonly BlacklistEntry[]): void {
    let grid = container.querySelector<HTMLElement>(`[data-testid="${PROFILES_TEST_ID}"]`);
    if (!grid) {
        grid = markOwned(document.createElement("div"), "blacklist-profiles");
        grid.dataset.testid = PROFILES_TEST_ID;
        list.after(grid);
    }
    grid.hidden = scope === "properties";
    if (scope === "properties") return;

    const profiles = getProfileEntries(blacklist, scope);
    grid.className = profiles.length > 0 ? "edf-profile-grid edf-blacklist-profile-grid" : "";
    grid.replaceChildren(...(profiles.length > 0
        ? profiles.map(profile => createProfileCard(profile))
        : [createEmptyState(
            PROFILE_EMPTY_COPY[scope].title,
            PROFILE_EMPTY_COPY[scope].description,
            replaceWithBinIcon,
            createSearchAction(),
        )]));
}

async function render(container: HTMLElement, list: HTMLElement): Promise<void> {
    const blacklist = await getBlacklist();
    const sortActions = container.querySelector<HTMLElement>(
        '[data-testid="extra-domain-filters-blacklist-sort-actions"]',
    );
    setListingsSubtitle(container, SUBTITLES[scope]);
    renderProfiles(container, list, blacklist);
    list.hidden = scope !== "properties";
    if (sortActions) sortActions.hidden = scope !== "properties";
    if (scope !== "properties") return;

    const all = blacklist.filter(entry => !isProfileEntry(entry));
    const active = all.filter(entry => !entry.removedAt);
    const activeUrls = new Set(active.map(entry => entry.url));
    const retained = [...retainedUnblacklistedEntries.values()]
        .filter(entry => !activeUrls.has(entry.url));
    updateStableNewestOrder(stableNewestOrder, [...active, ...retained]);
    const entries = sortBlacklistEntries([...active, ...retained], listingSort, stableNewestOrder);
    const controls = getPageActions({
        container,
        fallbackAnchor: list,
        id: "blacklist",
    });
    const renderRows = (): void => void render(container, list);
    const visibleIds = entries.map(entry => getBlacklistListing(entry).url);
    const syncCheckboxes = (): void => {
        for (const card of list.querySelectorAll<HTMLElement>("[data-blacklist-url]")) {
            const checkbox = card.querySelector<HTMLInputElement>(".edf-selection-checkbox input");
            if (checkbox) setSelectionCheckboxState(checkbox, selectedUrls.has(card.dataset.blacklistUrl ?? ""));
        }
    };
    const renderControls = (): void => {
        renderSelectionControls({
            buttonClassName: "edf-selection-action",
            clearLabel: "Unblacklist",
            controls,
            onClear: ids => {
                const selected = new Set(ids);
                for (const entry of entries) {
                    const url = getBlacklistListing(entry).url;
                    if (!selected.has(url)) continue;
                    retainedUnblacklistedEntries.set(url, entry);
                    selectedUrls.delete(url);
                }
                void removeBlacklistUrls(ids).then(renderRows);
            },
            onSelectionChange: ids => {
                replaceSelection(selectedUrls, ids);
                syncCheckboxes();
                renderControls();
            },
            selectedIds: [...selectedUrls],
            visibleIds,
        });
    };

    renderControls();
    if (entries.length === 0) {
        list.replaceChildren(createEmptyState(
            PROPERTIES_EMPTY_COPY.title,
            PROPERTIES_EMPTY_COPY.description,
            replaceWithBinIcon,
            createSearchAction(),
        ));
    } else {
        reconcileRows(list, entries, renderRows, renderControls);
    }
}

const mountBlacklistPage: PageMount = async context => {
    enableStickyHeader(context);
    retainedUnblacklistedEntries.clear();
    stableNewestOrder.clear();
    let current: { container: HTMLElement; list: HTMLElement } | undefined;
    const renderRows = (): void => {
        if (current) void render(current.container, current.list);
    };

    await keepListingsPageMounted(context.signal, async (container, signal) => {
        const restoreTitle = overridePageTitle(container, "Your blacklist", "Blacklisted properties");
        const { list, restore: restoreList } = installList(container);
        current = { container, list };

        await render(container, list);
        const actions = container.querySelector<HTMLElement>(
            '[data-testid="extra-domain-filters-blacklist-sort-actions"]',
        ) ?? undefined;
        const restoreTabs = replaceUserListingTabs(container, signal, {
            onChange: value => {
                scope = value as BlacklistScope;
                renderRows();
            },
            options: [["properties", "Properties"], ["agency", "Agencies"], ["agent", "Agents"]],
            selected: scope,
        }, actions);
        const restoreSort = installSortControl(container, {
            actionsTestId: "extra-domain-filters-blacklist-sort-actions",
            ariaLabel: "Sort blacklisted properties",
            onChange: value => {
                listingSort = value as BlacklistSort;
                renderRows();
            },
            options: [
                ["newest", "Newest"],
                ["oldest", "Oldest"],
                ["price-asc", "Lowest price"],
                ["price-desc", "Highest price"],
            ],
            signal,
        });
        return () => {
            container.querySelector(`[data-testid="${PROFILES_TEST_ID}"]`)?.remove();
            restoreTabs();
            restoreSort();
            restorePageActions(container, "blacklist");
            restoreTitle();
            restoreList();
        };
    });
    const unwatchBlacklist = onStorageChange<BlacklistEntry[]>("blacklist", renderRows);

    context.signal.addEventListener("abort", () => {
        retainedUnblacklistedEntries.clear();
        stableNewestOrder.clear();
        unwatchBlacklist();
    }, { once: true });
};

export default mountBlacklistPage;
