import { bindListingCards } from "../features/listing-cards";
import { PageMount } from "../shared/platform/router";
import { createSelectionCheckbox, renderSelectionControls } from "../shared/ui/selection";

const ACTION_BUTTON_CLASS = "css-8vgasn edf-action-button";

const selectedCardIds = new Set<string>();
const noteSaveTimers = new WeakMap<HTMLTextAreaElement, number>();

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
    controls.className = "edf-page-actions";
    controls.setAttribute("data-testid", "extra-domain-filters-shortlist-controls");
    const list = container.querySelector('[data-testid="listing-card-container"]')?.parentElement;
    const sort = container.querySelector<HTMLElement>('[data-testid="listing-tabs__filters-sort-by"]');
    if (!sort) {
        if (list) list.before(controls);
        else container.prepend(controls);
        return controls;
    }

    const actions = document.createElement("div");
    const label = document.createElement("span");
    actions.className = "edf-sort-actions";
    actions.setAttribute("data-testid", "extra-domain-filters-sort-actions");
    label.dataset.edfSortLabel = "true";
    label.textContent = "Sort by";
    sort.before(actions);
    actions.append(controls, label, sort);

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

        const priceRow = card.querySelector<HTMLElement>('[data-testid="listing-card-price-wrapper"]') ??
            card;
        priceRow.prepend(createSelectionCheckbox(
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

function configureInlineNotes(card: HTMLElement): void {
    const textarea = card.querySelector<HTMLTextAreaElement>("textarea");
    if (!textarea) return;

    if (textarea.disabled) {
        const editButton = [...card.querySelectorAll<HTMLButtonElement>("button")]
            .find(button => button.textContent?.trim() === "Edit Notes");
        if (editButton) {
            editButton.click();
            requestAnimationFrame(() => configureInlineNotes(card));
        }
        return;
    }

    if (textarea.dataset.edfInlineNotes === "true") return;
    textarea.dataset.edfInlineNotes = "true";
    textarea.addEventListener("input", () => {
        const timer = noteSaveTimers.get(textarea);
        if (timer !== undefined) window.clearTimeout(timer);

        noteSaveTimers.set(textarea, window.setTimeout(() => {
            const saveButton = [...card.querySelectorAll<HTMLButtonElement>("button")]
                .find(button => button.textContent?.trim() === "Save Notes");
            saveButton?.click();
        }, 600));
    });
}

function configureCards(container: HTMLElement): void {
    syncSelectionControls(container);
    getCards(container).forEach(configureInlineNotes);
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
            configureCards(container);
        },
        onSelectionChange: ids => {
            selectedCardIds.clear();
            for (const id of ids) selectedCardIds.add(id);
            renderControls(container);
            configureCards(container);
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
        configureCards(container);

        let frame: number | undefined;
        const schedule = (): void => {
            if (frame !== undefined) return;
            frame = requestAnimationFrame(() => {
                frame = undefined;
                renderControls(container);
                configureCards(container);
            });
        };
        const observer = new MutationObserver(mutations => {
            const hasDomainAddition = mutations.some(mutation =>
                [...mutation.addedNodes].some(node =>
                    node instanceof Element && !node.closest('[class*="edf-"]'),
                ),
            );
            if (hasDomainAddition) schedule();
        });
        observer.observe(container, { childList: true, subtree: true });
        context.signal.addEventListener("abort", () => {
            observer.disconnect();
            if (frame !== undefined) cancelAnimationFrame(frame);
        }, { once: true });
    }
};

export default mountShortlistPage;
