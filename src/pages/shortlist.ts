import { getBlacklist, removeBlacklistUrls, toggleBlacklistListing } from "../domain/blacklist/store";
import { isBlacklisted } from "../domain/matching";
import { bindListingCards } from "../features/listing-cards";
import { getListingSnapshot } from "../features/listing-cards/dom/card";
import { enableStickyHeader } from "../features/navigation";
import {
    findUserListingsContainer,
    getPageActions,
    getUserListingCards,
    getUserListingUrl,
    getUserListingUrls,
    replaceUserListingTabs,
} from "../features/user-listings/page";
import { PageMount } from "../shared/platform/router";
import {
    createSelectionCheckbox,
    renderSelectionControls,
    replaceSelection,
    setSelectionCheckboxState,
} from "../shared/ui/selection";
import { createSortControl } from "../shared/ui/sort";

const ACTION_BUTTON_CLASS = "edf-selection-action";

const selectedCardIds = new Set<string>();

type ReconcileCards = () => void;

function removeSelectionControls(container: HTMLElement): void {
    container.querySelectorAll(".edf-selection-checkbox").forEach(element => element.remove());
}

function configureNoteActions(card: HTMLElement, reconcileCards: ReconcileCards): void {
    const actions = card.querySelector<HTMLElement>('[data-testid="listing-card-buttons-wrapper"]');
    const textarea = card.querySelector<HTMLTextAreaElement>("textarea");
    if (!actions) {
        textarea?.classList.add("edf-listing-card-notes-default");
        card.classList.remove("edf-listing-card-notes-editing");
        return;
    }

    const save = [...actions.querySelectorAll<HTMLButtonElement>("button")]
        .find(button =>
            /save notes/i.test(button.textContent ?? "") ||
            button.dataset.edfNotesConfigured === "true",
        );
    if (!save) {
        card.classList.remove("edf-listing-card-notes-editing");
        card.querySelectorAll<HTMLElement>(
            ".edf-listing-card-notes-field, .edf-listing-card-notes-container",
        ).forEach(element => element.classList.remove(
            "edf-listing-card-notes-field",
            "edf-listing-card-notes-container",
        ));
        card.querySelectorAll<HTMLElement>(".edf-listing-card-notes-default")
            .forEach(element => element.classList.remove("edf-listing-card-notes-default"));
        textarea?.classList.add("edf-listing-card-notes-default");
        actions.querySelectorAll<HTMLButtonElement>("button").forEach(button => {
            const label = button.textContent?.trim().toLowerCase();
            if (label === "enquire") button.classList.add("edf-listing-card-enquire-action");
            if (label === "edit notes") {
                button.textContent = "View notes";
                button.ariaLabel = "View notes";
            }
        });
        return;
    }
    if (!textarea) return;
    textarea.classList.remove("edf-listing-card-notes-default");
    textarea.parentElement?.classList.add("edf-listing-card-notes-field");
    textarea.parentElement?.parentElement?.classList.add("edf-listing-card-notes-container");

    const buttons = [...actions.querySelectorAll<HTMLButtonElement>("button")];
    const cancel = buttons.find(button => /cancel/i.test(button.textContent ?? ""));
    if (!cancel || !save || save.dataset.edfNotesConfigured === "true") return;

    cancel.classList.add("edf-listing-card-notes-cancel");
    save.dataset.edfNotesConfigured = "true";
    save.textContent = "View details";
    save.ariaLabel = "View listing details";
    save.addEventListener("click", event => {
        if (textarea.value.trim()) return;
        event.preventDefault();
        event.stopImmediatePropagation();
        cancel.click();
    }, { capture: true });
    save.addEventListener("click", () => {
        window.setTimeout(reconcileCards, 120);
    });
}

function syncSelectionControls(container: HTMLElement, reconcileCards: ReconcileCards): void {
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
            const savesNotes = [...noteActions.querySelectorAll<HTMLButtonElement>("button")]
                .some(button =>
                    /save notes/i.test(button.textContent ?? "") ||
                    button.dataset.edfNotesConfigured === "true",
                );
            card.classList.toggle("edf-listing-card-notes-editing", savesNotes);
            noteActions.prepend(checkbox);
            configureNoteActions(card, reconcileCards);
            continue;
        }

        card.classList.remove("edf-listing-card-notes-editing");
        const priceRow = card.querySelector<HTMLElement>('[data-testid="listing-card-price-wrapper"]') ?? card;
        priceRow.classList.add("edf-listing-card-button-container");
        priceRow.prepend(checkbox);
    }
}

function configureCards(
    container: HTMLElement,
    reconcileCards: ReconcileCards = () => undefined,
): void {
    syncSelectionControls(container, reconcileCards);
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

function installSortControl(container: HTMLElement, signal: AbortSignal): () => void {
    const nativeSort = container.querySelector<HTMLElement>('[data-testid="listing-tabs__filters-sort-by"]');
    const actions = container.querySelector<HTMLElement>('[data-testid="extra-domain-filters-shortlist-sort-actions"]');
    const filterGroup = actions?.querySelector<HTMLElement>(".edf-control-group:last-child");
    const nativeLabel = actions?.querySelector<HTMLElement>('[data-edf-sort-label="true"]');
    if (!nativeSort || !filterGroup) return () => undefined;

    const sort = createSortControl({
        ariaLabel: "Sort shortlisted properties",
        onChange: () => chooseNativeSort(nativeSort, sort.value()),
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

    nativeSort.hidden = true;
    if (nativeLabel) nativeLabel.hidden = true;
    filterGroup.append(sort.element);

    return () => {
        nativeSort.hidden = false;
        if (nativeLabel) nativeLabel.hidden = false;
        sort.element.remove();
    };
}

const mountShortlistPage: PageMount = async (context) => {
    enableStickyHeader(context);
    const refreshListingCards = bindListingCards(context, { showBlacklistedView: false });
    const container = findUserListingsContainer();
    if (container) {
        let frame: number | undefined;
        let reconcileTimer: number | undefined;
        const recoveryFrames = new Set<number>();
        const reconcileCards = (): void => {
            if (reconcileTimer !== undefined) {
                window.clearTimeout(reconcileTimer);
                reconcileTimer = undefined;
            }
            const currentContainer = findUserListingsContainer();
            if (!currentContainer) return;
            configureCards(currentContainer, schedule);
        };
        const schedule = (): void => {
            if (reconcileTimer !== undefined) window.clearTimeout(reconcileTimer);
            reconcileTimer = window.setTimeout(reconcileCards, 120);
        };
        const recoverCard = (): void => {
            refreshListingCards();
            schedule();
        };
        const scheduleCardRecovery = (): void => {
            const firstFrame = requestAnimationFrame(() => {
                recoveryFrames.delete(firstFrame);
                recoverCard();
                const secondFrame = requestAnimationFrame(() => {
                    recoveryFrames.delete(secondFrame);
                    recoverCard();
                });
                recoveryFrames.add(secondFrame);
            });
            recoveryFrames.add(firstFrame);
        };
        await renderControls(container);
        configureCards(container, schedule);
        const actions = container.querySelector<HTMLElement>(
            '[data-testid="extra-domain-filters-shortlist-sort-actions"]',
        ) ?? undefined;
        const restoreTabs = replaceUserListingTabs(container, context.signal, undefined, actions);
        const restoreSort = installSortControl(container, context.signal);

        const scheduleControls = (): void => {
            if (frame !== undefined) return;
            frame = requestAnimationFrame(() => {
                frame = undefined;
                void renderControls(container);
                configureCards(container, schedule);
            });
        };
        const observer = new MutationObserver(mutations => {
            const hasDomainAddition = mutations.some(mutation =>
                [...mutation.addedNodes].some(node =>
                    node instanceof Element && !node.closest('[class*="edf-"]'),
                ),
            );
            if (hasDomainAddition) scheduleControls();
        });
        observer.observe(container, { childList: true, subtree: true });
        container.addEventListener("click", event => {
            const button = (event.target as Element | null)?.closest<HTMLButtonElement>("button");
            const label = button?.textContent?.trim().toLowerCase();
            if (label === "view notes" || label === "view details" || label === "edit notes") {
                scheduleCardRecovery();
            }
        }, { capture: true, signal: context.signal });
        scheduleControls();
        context.signal.addEventListener("abort", () => {
            observer.disconnect();
            restoreTabs();
            restoreSort();
            if (frame !== undefined) cancelAnimationFrame(frame);
            if (reconcileTimer !== undefined) window.clearTimeout(reconcileTimer);
            recoveryFrames.forEach(frameId => cancelAnimationFrame(frameId));
        }, { once: true });
    }
};

export default mountShortlistPage;
