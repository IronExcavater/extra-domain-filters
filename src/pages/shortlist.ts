import { getBlacklist, toggleBlacklistListing } from "../domain/blacklist/store";
import { isBlacklisted } from "../domain/matching";
import { bindListingCards } from "../features/listing-cards";
import { getListingSnapshot } from "../features/listing-cards/dom/card";
import { PageMount } from "../shared/platform/router";
import { createSelectionCheckbox, renderSelectionControls } from "../shared/ui/selection";

const ACTION_BUTTON_CLASS = "css-8vgasn edf-action-button";

const selectedCardIds = new Set<string>();
const noteValues = new WeakMap<HTMLTextAreaElement, string>();

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
        priceRow.classList.add("edf-listing-card-button-container");
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

function findCardButton(card: HTMLElement, label: string): HTMLButtonElement | undefined {
    return [...card.querySelectorAll<HTMLButtonElement>("button")]
        .find(button => button.textContent?.trim() === label);
}

function setNativeTextareaValue(textarea: HTMLTextAreaElement, value: string): void {
    Object.getOwnPropertyDescriptor(HTMLTextAreaElement.prototype, "value")
        ?.set?.call(textarea, value);
    textarea.dispatchEvent(new Event("input", { bubbles: true }));
    textarea.dispatchEvent(new Event("change", { bubbles: true }));
}

async function saveInlineNote(card: HTMLElement, editor: HTMLTextAreaElement): Promise<void> {
    const value = editor.value.trim();
    if (noteValues.get(editor) === value) return;

    findCardButton(card, "Edit Notes")?.click();
    await new Promise<void>(resolve => requestAnimationFrame(() => requestAnimationFrame(() => resolve())));

    const nativeEditor = [...card.querySelectorAll<HTMLTextAreaElement>("textarea")]
        .find(textarea => textarea !== editor);
    if (!nativeEditor) return;

    setNativeTextareaValue(nativeEditor, value);
    findCardButton(card, "Save Notes")?.click();
    noteValues.set(editor, value);
}

function configureInlineNote(card: HTMLElement): void {
    const textarea = card.querySelector<HTMLTextAreaElement>("textarea:not(.edf-inline-note)");
    if (!textarea?.disabled) return;

    const editor = textarea.cloneNode(true) as HTMLTextAreaElement;
    editor.classList.add("edf-inline-note");
    editor.disabled = false;
    editor.readOnly = false;
    editor.value = textarea.value;
    noteValues.set(editor, editor.value.trim());
    editor.addEventListener("blur", () => void saveInlineNote(card, editor));
    editor.addEventListener("keydown", event => {
        if ((event.metaKey || event.ctrlKey) && event.key === "Enter") editor.blur();
    });
    textarea.replaceWith(editor);
}

function configureCards(container: HTMLElement): void {
    syncSelectionControls(container);
    getCards(container).forEach(configureInlineNote);
}

function clearCards(container: HTMLElement, ids: readonly string[]): void {
    const selected = new Set(ids);

    for (const card of getCards(container)) {
        const id = getCardId(card);
        if (!id || !selected.has(id)) continue;

        card.querySelector<HTMLButtonElement>('[data-testid="listing-card-shortlist-shortlisted"]')?.click();
    }
}

async function blacklistCards(container: HTMLElement, ids: readonly string[]): Promise<void> {
    const selected = new Set(ids);
    const blacklist = await getBlacklist();

    for (const card of getCards(container)) {
        const id = getCardId(card);
        if (!id || !selected.has(id) || isBlacklisted(blacklist, id)) continue;

        await toggleBlacklistListing(getListingSnapshot(card, id));
        card.querySelector<HTMLButtonElement>('[data-testid="listing-card-shortlist-shortlisted"]')?.click();
    }
}

function renderControls(container: HTMLElement): void {
    const controls = getControls(container);
    const cards = getCards(container);
    const visibleIds = getCardIds(cards);

    renderSelectionControls({
        actions: [{
            label: "Blacklist",
            onAction: ids => {
                void blacklistCards(container, ids).then(() => selectedCardIds.clear());
            },
        }],
        buttonClassName: ACTION_BUTTON_CLASS,
        clearLabel: "Remove from shortlist",
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
