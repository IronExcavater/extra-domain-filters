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
    type BlacklistFilter,
    type BlacklistSort,
} from "../features/blacklist/sort";
import { enableStickyHeader } from "../features/navigation";
import {
    getPageActions,
    overridePageTitle,
    replaceUserListingTabs,
    restorePageActions,
    waitForUserListingsContainer,
} from "../features/user-listings/page";
import { markOwned } from "../shared/dom/ownership";
import { PageMount } from "../shared/platform/router";
import { onStorageChange } from "../shared/platform/storage";
import {
    renderSelectionControls,
    replaceSelection,
    setSelectionCheckboxState,
} from "../shared/ui/selection";
import { createSortControl } from "../shared/ui/sort";

const selectedUrls = new Set<string>();
const retainedUnblacklistedEntries = new Map<string, BlacklistEntry>();
let listingFilter: BlacklistFilter = "all";
let listingSort: BlacklistSort = "newest";

function getRowVersion(entry: BlacklistEntry): string {
    return JSON.stringify({
        addedAt: entry.addedAt,
        listing: getBlacklistListing(entry),
    });
}

function installSortControl(
    container: HTMLElement,
    renderRows: () => void,
    signal: AbortSignal,
): () => void {
    const nativeSort = container.querySelector<HTMLElement>(
        '[data-testid="listing-tabs__filters-sort-by"]',
    );
    const sortActions = container.querySelector<HTMLElement>(
        '[data-testid="extra-domain-filters-blacklist-sort-actions"]',
    );
    const filterGroup = sortActions?.querySelector<HTMLElement>(".edf-control-group:last-child");
    const nativeLabel = sortActions?.querySelector<HTMLElement>('[data-edf-sort-label="true"]');
    if (!filterGroup) return () => undefined;

    const sort = createSortControl({
        ariaLabel: "Sort blacklisted properties",
        onChange: () => {
            listingSort = sort.value() as BlacklistSort;
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

    if (nativeSort) nativeSort.hidden = true;
    if (nativeLabel) nativeLabel.hidden = true;
    filterGroup.append(markOwned(sort.element, "blacklist-sort"));

    return () => {
        if (nativeSort) nativeSort.hidden = false;
        if (nativeLabel) nativeLabel.hidden = false;
        sort.element.remove();
    };
}

function installList(container: HTMLElement): { list: HTMLElement; restore: () => void } {
    const existing = container.querySelector<HTMLElement>(
        '[data-testid="extra-domain-filters-blacklist-list"]',
    );
    if (existing) return { list: existing, restore: () => undefined };

    const nativeList = container
        .querySelector('[data-testid="listing-card-container"]')
        ?.parentElement;
    const list = document.createElement("div");

    list.className = "edf-blacklist-card-grid edf-blacklist-page-grid";
    list.dataset.testid = "extra-domain-filters-blacklist-list";
    markOwned(list, "blacklist-list");
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

function preserveMessage(container: HTMLElement): () => void {
    const message = container.querySelector<HTMLElement>('[data-testid="shortlist__message_wrapper"]');
    if (!message) return () => undefined;

    const hidden = message.hidden;
    const text = message.textContent;

    return () => {
        message.hidden = hidden;
        message.textContent = text;
    };
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
    const entries = sortBlacklistEntries(
        filterBlacklistEntries([...active, ...retained], listingFilter),
        listingSort,
    );
    const controls = getPageActions({
        container,
        fallbackAnchor: list,
        id: "blacklist",
    });
    const message = container.querySelector<HTMLElement>('[data-testid="shortlist__message_wrapper"]');
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
    if (message) {
        message.hidden = entries.length > 0;
        if (entries.length === 0) message.textContent = "No blacklisted properties yet.";
    }
    reconcileRows(list, entries, renderRows, renderControls);
}

const mountBlacklistPage: PageMount = async context => {
    enableStickyHeader(context);
    retainedUnblacklistedEntries.clear();
    const container = await waitForUserListingsContainer(context.signal);
    const restoreTitle = overridePageTitle(container, "Your blacklist", "Blacklisted properties");
    const restoreMessage = preserveMessage(container);
    const { list, restore: restoreList } = installList(container);
    const renderRows = (): void => void render(container, list);

    await render(container, list);
    const actions = container.querySelector<HTMLElement>(
        '[data-testid="extra-domain-filters-blacklist-sort-actions"]',
    ) ?? undefined;
    const restoreTabs = replaceUserListingTabs(container, context.signal, filter => {
        listingFilter = filter;
        renderRows();
    }, actions);
    const restoreSort = installSortControl(container, renderRows, context.signal);
    const unwatchBlacklist = onStorageChange<BlacklistEntry[]>("blacklist", renderRows);

    context.signal.addEventListener("abort", () => {
        retainedUnblacklistedEntries.clear();
        unwatchBlacklist();
        restoreTabs();
        restoreSort();
        restorePageActions(container, "blacklist");
        restoreMessage();
        restoreTitle();
        restoreList();
    }, { once: true });
};

export default mountBlacklistPage;
