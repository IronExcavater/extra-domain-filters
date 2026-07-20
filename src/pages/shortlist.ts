import { bindListingCards } from "../features/listing-cards";
import { PageMount } from "../shared/platform/router";
import { createSelectionCheckbox, renderSelectionControls } from "../shared/ui/selection";

const ACTION_BUTTON_CLASS = "css-8vgasn edf-action-button";

const selectedCardIds = new Set<string>();

function getContainer(): HTMLElement | undefined {
    const root = document.querySelector("#shortlist");

    return root?.firstElementChild instanceof HTMLElement
        ? root.firstElementChild
        : undefined;
}

function getCards(container: HTMLElement): HTMLElement[] {
    return [...container.querySelectorAll<HTMLElement>('[data-testid="listing-card-container"]')];
}

function getCardId(card: HTMLElement): string | undefined {
    const url = card.querySelector<HTMLAnchorElement>('a[href*="domain.com.au"]')?.href;
    return url ? new URL(url, window.location.origin).href : undefined;
}

function getCardIds(cards: readonly HTMLElement[]): string[] {
    return cards
        .map(getCardId)
        .filter((id): id is string => id !== undefined);
}

function getControls(container: HTMLElement): HTMLElement {
    const existing = container.querySelector<HTMLElement>('[data-testid="extra-domain-filters-shortlist-controls"]');
    if (existing) return existing;

    const controls = document.createElement("div");
    const sort = container.querySelector('[data-testid="listing-tabs__filters-sort-by"]');

    controls.className = "edf-page-actions";
    controls.setAttribute("data-testid", "extra-domain-filters-shortlist-controls");
    if (sort?.parentElement) {
        const label = document.createElement("span");
        label.className = "edf-sort-label";
        label.textContent = "Sort by";
        sort.parentElement.insertBefore(controls, sort);
        sort.parentElement.insertBefore(label, sort);
    } else container.prepend(controls);

    return controls;
}

function removeSelectionControls(container: HTMLElement): void {
    container.querySelectorAll(".edf-selection-checkbox").forEach(element => element.remove());
}

function syncSelectionControls(container: HTMLElement): void {
    removeSelectionControls(container);

    for (const card of getCards(container)) {
        const id = getCardId(card);
        if (!id) continue;

        const titleRow = card.querySelector<HTMLElement>('[data-testid="listing-card-price-wrapper"]');
        (titleRow ?? card).prepend(createSelectionCheckbox(
            selectedCardIds.has(id),
            "Select shortlisted listing",
            checked => {
                if (checked) selectedCardIds.add(id);
                else selectedCardIds.delete(id);
                renderControls(container);
            },
        ));
    }
}

function clearCards(container: HTMLElement, ids: readonly string[]): void {
    const selected = new Set(ids);

    for (const card of getCards(container)) {
        const id = getCardId(card);
        if (!id || !selected.has(id)) continue;

        card.querySelector<HTMLButtonElement>('[data-testid="listing-card-shortlist-shortlisted"]')?.click();
    }
}

function renderControls(container: HTMLElement): void {
    const controls = getControls(container);
    const cards = getCards(container);
    const visibleIds = getCardIds(cards);

    renderSelectionControls({
        buttonClassName: ACTION_BUTTON_CLASS,
        controls,
        onClear: ids => {
            clearCards(container, ids);
            selectedCardIds.clear();
            renderControls(container);
            syncSelectionControls(container);
        },
        onSelectionChange: ids => {
            selectedCardIds.clear();
            for (const id of ids) selectedCardIds.add(id);
            renderControls(container);
            syncSelectionControls(container);
        },
        selectedIds: [...selectedCardIds],
        visibleIds,
    });
}

const mountShortlistPage: PageMount = async (context) => {
    bindListingCards(context, { showBlacklistedView: false });
    const container = getContainer();
    if (container) {
        renderControls(container);
        syncSelectionControls(container);
    }
};

export default mountShortlistPage;
