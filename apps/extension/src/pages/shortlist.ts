import { isOwnedNode, markOwned } from "../dom/ownership";
import { createEmptyState, createSearchAction, type SearchMode } from "../ui/collection";
import { replaceWithPopupStarIcon } from "../ui/icons";
import { getBlacklist, removeBlacklistUrls, toggleBlacklistListing } from "../domain/blacklist/store";
import { isBlacklisted } from "../domain/matching";
import { bindListingCards } from "../features/listing-cards";
import { getListingSnapshot } from "../features/listing-cards/dom/card";
import { enableStickyHeader } from "../features/navigation";
import {
    getPageActions,
    getUserListingCards,
    getUserListingUrl,
    getUserListingUrls,
    installSortControl,
    keepListingsPageMounted,
    replaceUserListingTabs,
    setListingsSubtitle,
    SHORTLIST_SUBTITLE,
} from "../features/user-listings/page";
import { bindShortlistNotes, watchShortlistNotes } from "../features/user-listings/notes";
import { PageMount } from "../platform/router";
import {
    createSelectionCheckbox,
    renderSelectionControls,
    replaceSelection,
    setSelectionCheckboxState,
} from "../ui/selection";

const ACTION_BUTTON_CLASS = "edf-selection-action";

const selectedCardIds = new Set<string>();

function removeSelectionControls(container: HTMLElement): void {
    container.querySelectorAll(".edf-selection-checkbox").forEach(element => element.remove());
}

function syncSelectionControls(container: HTMLElement): void {
    removeSelectionControls(container);

    for (const card of getUserListingCards(container)) {
        const id = getUserListingUrl(card);
        if (!id) continue;

        const checkbox = createSelectionCheckbox(
            selectedCardIds.has(id),
            "Select shortlisted listing",
            checked => {
                if (checked) selectedCardIds.add(id);
                else selectedCardIds.delete(id);
                void renderControls(container);
            },
        );
        const noteActions = card.querySelector<HTMLElement>('[data-testid="listing-card-buttons-wrapper"]');
        if (noteActions) {
            noteActions.prepend(checkbox);
            noteActions.querySelectorAll<HTMLButtonElement>("button").forEach(button => {
                if (button.textContent?.trim().toLowerCase() === "enquire") {
                    button.classList.add("edf-listing-card-enquire-action");
                }
            });
            bindShortlistNotes(card, id);
            continue;
        }

        const priceRow = card.querySelector<HTMLElement>('[data-testid="listing-card-price-wrapper"]') ?? card;
        priceRow.classList.add("edf-listing-card-button-container");
        priceRow.prepend(checkbox);
    }
}

const NATIVE_EMPTY_SELECTOR = '[data-testid="listings-nofound-container"]';
const EMPTY_TEST_ID = "extra-domain-filters-shortlist-empty";
const EMPTY_COPY: Record<string, { description: string; mode: SearchMode; title: string }> = {
    all: {
        title: "No shortlisted properties yet",
        description: "Tap the star on any listing to save it to your shortlist.",
        mode: "buy",
    },
    buy: {
        title: "No properties for sale shortlisted",
        description: "Tap the star on a listing for sale to save it here.",
        mode: "buy",
    },
    rent: {
        title: "No rentals shortlisted",
        description: "Tap the star on a rental listing to save it here.",
        mode: "rent",
    },
    "new homes": {
        title: "No new homes shortlisted",
        description: "Tap the star on a new home or project to save it here.",
        mode: "new homes",
    },
};

/**
 * Domain's "No shortlisted properties, yet :(" becomes the shared empty state, worded for the
 * tab in view and with the same search button. Domain still decides when it shows.
 */
function syncEmptyState(container: HTMLElement): void {
    const native = container.querySelector<HTMLElement>(NATIVE_EMPTY_SELECTOR);
    const existing = container.querySelector<HTMLElement>(`[data-testid="${EMPTY_TEST_ID}"]`);
    if (!native) {
        existing?.remove();
        return;
    }
    const tab = container.querySelector(
        '[role="tablist"]:not([data-extra-domain-filters-owner]) [role="tab"][aria-selected="true"]',
    )?.textContent?.trim().toLowerCase() ?? "all";
    if (existing?.dataset.tab === tab && existing.previousElementSibling === native) return;

    const copy = EMPTY_COPY[tab] ?? EMPTY_COPY.all;
    const empty = markOwned(
        createEmptyState(copy.title, copy.description, replaceWithPopupStarIcon, createSearchAction(copy.mode)),
        "shortlist-empty",
    );
    empty.dataset.testid = EMPTY_TEST_ID;
    empty.dataset.tab = tab;
    native.dataset.edfReplaced = "true";
    existing?.remove();
    native.after(empty);
}

function configureCards(container: HTMLElement): void {
    setListingsSubtitle(container, SHORTLIST_SUBTITLE);
    syncSelectionControls(container);
    syncEmptyState(container);
}

function syncSelectedCards(container: HTMLElement): void {
    for (const card of getUserListingCards(container)) {
        const id = getUserListingUrl(card);
        const checkbox = card.querySelector<HTMLInputElement>(".edf-selection-checkbox input");
        if (id && checkbox) setSelectionCheckboxState(checkbox, selectedCardIds.has(id));
    }
}

function clearCards(container: HTMLElement, ids: readonly string[]): void {
    const selected = new Set(ids);

    for (const card of getUserListingCards(container)) {
        const id = getUserListingUrl(card);
        if (!id || !selected.has(id)) continue;

        card.querySelector<HTMLButtonElement>('[data-testid="listing-card-shortlist-shortlisted"]')?.click();
    }
}

async function toggleBlacklistCards(container: HTMLElement, ids: readonly string[]): Promise<void> {
    const selected = new Set(ids);
    const blacklist = await getBlacklist();

    if (ids.some(id => isBlacklisted(blacklist, id))) {
        await removeBlacklistUrls(ids);
        return;
    }

    for (const card of getUserListingCards(container)) {
        const id = getUserListingUrl(card);
        if (!id || !selected.has(id) || isBlacklisted(blacklist, id)) continue;

        await toggleBlacklistListing(getListingSnapshot(card, id));
        card.querySelector<HTMLButtonElement>('[data-testid="listing-card-shortlist-shortlisted"]')?.click();
    }
}

async function renderControls(container: HTMLElement): Promise<void> {
    const cards = getUserListingCards(container);
    const controls = getPageActions({
        id: "shortlist",
        container,
        fallbackAnchor: cards[0]?.parentElement instanceof HTMLElement
            ? cards[0].parentElement
            : container,
    });
    const visibleIds = getUserListingUrls(cards);
    const blacklist = await getBlacklist();
    const selectedIds = [...selectedCardIds];
    const hasBlacklistedSelection = selectedIds.some(id => isBlacklisted(blacklist, id));

    renderSelectionControls({
        actions: [{
            label: hasBlacklistedSelection ? "Unblacklist" : "Blacklist",
            onAction: ids => {
                void toggleBlacklistCards(container, ids).then(() => void renderControls(container));
            },
        }],
        buttonClassName: ACTION_BUTTON_CLASS,
        clearLabel: "Unshortlist",
        controls,
        onClear: ids => {
            clearCards(container, ids);
            void renderControls(container);
            configureCards(container);
        },
        onSelectionChange: ids => {
            replaceSelection(selectedCardIds, ids);
            syncSelectedCards(container);
            void renderControls(container);
        },
        selectedIds: [...selectedCardIds],
        visibleIds,
    });
}

function chooseNativeSort(nativeSort: HTMLElement, label: string): void {
    nativeSort.querySelector<HTMLButtonElement>("button")?.click();
    requestAnimationFrame(() => {
        const option = [...document.querySelectorAll<HTMLElement>('[role="option"]')]
            .find(candidate => candidate.textContent?.trim().toLowerCase() === label.toLowerCase());

        option?.click();
    });
}

const mountShortlistPage: PageMount = async (context) => {
    enableStickyHeader(context);
    const refreshListingCards = bindListingCards(context, { showBlacklistedView: false });

    await keepListingsPageMounted(context.signal, async (container, signal) => {
        let frame: number | undefined;
        await renderControls(container);
        configureCards(container);
        const actions = container.querySelector<HTMLElement>(
            '[data-testid="extra-domain-filters-shortlist-sort-actions"]',
        ) ?? undefined;
        const restoreTabs = replaceUserListingTabs(container, signal, undefined, actions);
        const restoreSort = installSortControl(container, {
            actionsTestId: "extra-domain-filters-shortlist-sort-actions",
            ariaLabel: "Sort shortlisted properties",
            onChange: (value, nativeSort) => {
                if (nativeSort) chooseNativeSort(nativeSort, value);
            },
            options: [
                ["Date shortlisted", "Date shortlisted"],
                ["Newest", "Newest"],
                ["Lowest price", "Lowest price"],
                ["Highest price", "Highest price"],
                ["Earliest inspection", "Earliest inspection"],
                ["Suburb", "Suburb"],
            ],
            signal,
        });

        const scheduleControls = (): void => {
            if (frame !== undefined) return;
            frame = requestAnimationFrame(() => {
                frame = undefined;
                refreshListingCards();
                void renderControls(container);
                configureCards(container);
            });
        };
        const observer = new MutationObserver(mutations => {
            const hasDomainAddition = mutations.some(mutation =>
                [...mutation.addedNodes].some(node =>
                    node instanceof Element && !isOwnedNode(node),
                ),
            );
            if (hasDomainAddition) scheduleControls();
        });
        observer.observe(container, { childList: true, subtree: true });
        const unwatchNotes = watchShortlistNotes(scheduleControls);
        scheduleControls();
        return () => {
            observer.disconnect();
            unwatchNotes();
            restoreTabs();
            restoreSort();
            if (frame !== undefined) cancelAnimationFrame(frame);
        };
    });
};

export default mountShortlistPage;
