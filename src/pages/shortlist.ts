import { bindListingCards } from "../features/listing-cards";
import { PageMount } from "../shared/platform/router";

const selectedCards = new WeakSet<HTMLElement>();
let selectionMode = false;

function getContainer(): HTMLElement | undefined {
    const root = document.querySelector("#shortlist");

    return root?.firstElementChild instanceof HTMLElement
        ? root.firstElementChild
        : undefined;
}

function getCards(container: HTMLElement): HTMLElement[] {
    return [...container.querySelectorAll<HTMLElement>('[data-testid="listing-card-container"]')];
}

function getControls(container: HTMLElement): HTMLElement {
    const existing = container.querySelector<HTMLElement>('[data-testid="extra-domain-filters-shortlist-controls"]');
    if (existing) return existing;

    const controls = document.createElement("div");
    const sort = container.querySelector('[data-testid="listing-tabs__filters-sort-by"]');

    controls.className = "edf-blacklist-page-controls";
    controls.setAttribute("data-testid", "extra-domain-filters-shortlist-controls");
    if (sort?.parentElement) sort.parentElement.insertBefore(controls, sort);
    else container.prepend(controls);

    return controls;
}

function removeSelectionControls(container: HTMLElement): void {
    container.querySelectorAll(".edf-selection-checkbox").forEach(element => element.remove());
}

function syncSelectionControls(container: HTMLElement): void {
    removeSelectionControls(container);
    if (!selectionMode) return;

    for (const card of getCards(container)) {
        const label = document.createElement("label");
        const input = document.createElement("input");

        label.className = "edf-selection-checkbox";
        input.type = "checkbox";
        input.ariaLabel = "Select shortlisted listing";
        input.checked = selectedCards.has(card);
        input.addEventListener("change", () => {
            if (input.checked) selectedCards.add(card);
            else selectedCards.delete(card);
            renderControls(container);
        });
        label.append(input);
        card.prepend(label);
    }
}

function clearSelected(container: HTMLElement): void {
    for (const card of getCards(container)) {
        if (!selectedCards.has(card)) continue;

        card.querySelector<HTMLButtonElement>('[data-testid="listing-card-shortlist-shortlisted"]')?.click();
    }
}

function renderControls(container: HTMLElement): void {
    const controls = getControls(container);
    const cards = getCards(container);
    const selectedCount = cards.filter(card => selectedCards.has(card)).length;
    const selectionButton = document.createElement("button");
    const selectAllButton = document.createElement("button");
    const clearButton = document.createElement("button");

    selectionButton.type = "button";
    selectionButton.className = "css-8vgasn edf-blacklist-clear-button";
    selectionButton.textContent = selectionMode ? "Cancel selection" : "Select";
    selectionButton.addEventListener("click", () => {
        selectionMode = !selectionMode;
        if (!selectionMode) {
            for (const card of cards) selectedCards.delete(card);
        }
        renderControls(container);
        syncSelectionControls(container);
    });

    selectAllButton.type = "button";
    selectAllButton.className = "css-8vgasn edf-blacklist-clear-button";
    selectAllButton.hidden = !selectionMode;
    selectAllButton.textContent = selectedCount === cards.length ? "Deselect all" : "Select all";
    selectAllButton.addEventListener("click", () => {
        if (selectedCount === cards.length) {
            for (const card of cards) selectedCards.delete(card);
        } else {
            for (const card of cards) selectedCards.add(card);
        }
        renderControls(container);
        syncSelectionControls(container);
    });

    clearButton.type = "button";
    clearButton.className = "css-8vgasn edf-blacklist-clear-button";
    clearButton.textContent = selectionMode ? "Clear selected" : "Clear all";
    clearButton.disabled = selectionMode ? selectedCount === 0 : cards.length === 0;
    clearButton.addEventListener("click", () => {
        if (!selectionMode) {
            for (const card of cards) selectedCards.add(card);
        }
        clearSelected(container);
        for (const card of cards) selectedCards.delete(card);
        renderControls(container);
        syncSelectionControls(container);
    });

    controls.replaceChildren(selectionButton, selectAllButton, clearButton);
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
