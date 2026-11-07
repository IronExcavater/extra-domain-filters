import { onBodyMutations } from "../dom/bodyMutations";
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
import { createBlacklistCard } from "../features/blacklist/card";
import {
    filterBlacklistEntries,
    sortBlacklistEntries,
    updateStableNewestOrder,
    type BlacklistFilter,
    type BlacklistSort,
} from "../features/blacklist/sort";
import { enableStickyHeader } from "../features/navigation";
import {
    getPageActions,
    installSortControl,
    LISTING_CARD_SELECTOR,
    overridePageTitle,
    relocateShortlistTogetherMessage,
    replaceUserListingTabs,
    restorePageActions,
    waitForUserListingsContainer,
} from "../features/user-listings/page";
import { PageMount } from "../platform/router";
import { onStorageChange } from "../platform/storage";
import { createEmptyState } from "../ui/collection";
import { replaceWithBinIcon } from "../ui/icons";
import {
    renderSelectionControls,
    replaceSelection,
    setSelectionCheckboxState,
} from "../ui/selection";

const selectedUrls = new Set<string>();
const retainedUnblacklistedEntries = new Map<string, BlacklistEntry>();
let listingFilter: BlacklistFilter = "all";
let listingSort: BlacklistSort = "newest";
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

async function render(container: HTMLElement, list: HTMLElement): Promise<void> {
    const all = await getBlacklist();
    const active = all.filter(entry => !entry.removedAt);
    const activeUrls = new Set(active.map(entry => entry.url));
    const retained = [...retainedUnblacklistedEntries.values()]
        .filter(entry => !activeUrls.has(entry.url));
    updateStableNewestOrder(stableNewestOrder, [...active, ...retained]);
    const entries = sortBlacklistEntries(
        filterBlacklistEntries([...active, ...retained], listingFilter),
        listingSort,
        stableNewestOrder,
    );
    const controls = getPageActions({
        container,
        fallbackAnchor: list,
        id: "blacklist",
    });
    relocateShortlistTogetherMessage(container);
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
            "No blacklisted properties",
            "Properties hidden from Domain results will appear here.",
            replaceWithBinIcon,
        ));
    } else {
        reconcileRows(list, entries, renderRows, renderControls);
    }
}

const mountBlacklistPage: PageMount = async context => {
    enableStickyHeader(context);
    retainedUnblacklistedEntries.clear();
    stableNewestOrder.clear();
    let current: { container: HTMLElement; list: HTMLElement; teardown(): void } | undefined;
    let installing = false;
    const renderRows = (): void => {
        if (current) void render(current.container, current.list);
    };

    const install = async (): Promise<void> => {
        if (installing) return;
        installing = true;
        try {
            current?.teardown();
            const container = await waitForUserListingsContainer(context.signal);
            const restoreTitle = overridePageTitle(container, "Your blacklist", "Blacklisted properties");
            const { list, restore: restoreList } = installList(container);
            current = { container, list, teardown: () => undefined };

            await render(container, list);
            const actions = container.querySelector<HTMLElement>(
                '[data-testid="extra-domain-filters-blacklist-sort-actions"]',
            ) ?? undefined;
            const restoreTabs = replaceUserListingTabs(container, context.signal, filter => {
                listingFilter = filter;
                renderRows();
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
                signal: context.signal,
            });
            current.teardown = () => {
                restoreTabs();
                restoreSort();
                restorePageActions(container, "blacklist");
                restoreTitle();
                restoreList();
            };
        } finally {
            installing = false;
        }
    };

    await install();
    // The content script can find Domain's server-rendered shortlist before React hydrates
    // it; hydration then re-renders that subtree and drops our list. Re-install whenever
    // our list is no longer attached.
    onBodyMutations(() => {
        if (current && !current.list.isConnected) void install();
    }, context.signal);
    const unwatchBlacklist = onStorageChange<BlacklistEntry[]>("blacklist", renderRows);

    context.signal.addEventListener("abort", () => {
        retainedUnblacklistedEntries.clear();
        stableNewestOrder.clear();
        unwatchBlacklist();
        current?.teardown();
    }, { once: true });
};

export default mountBlacklistPage;
