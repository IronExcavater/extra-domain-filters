import { getBlacklist, toggleBlacklistListing } from "../domain/blacklist/store";
import { isBlacklisted } from "../domain/matching";
import { bindListingCards } from "../features/listing-cards";
import { getListingSnapshot } from "../features/listing-cards/dom/card";
import {
    findUserListingsContainer,
    getPageActions,
    getUserListingCards,
    getUserListingUrl,
    getUserListingUrls,
} from "../features/user-listings/page";
import { PageMount } from "../shared/platform/router";
import { createSelectionCheckbox, renderSelectionControls, replaceSelection } from "../shared/ui/selection";

const ACTION_BUTTON_CLASS = "css-8vgasn edf-action-button";
const NOTE_MAX_HEIGHT = 144;

const selectedCardIds = new Set<string>();
const noteValues = new WeakMap<HTMLTextAreaElement, string>();

function removeSelectionControls(container: HTMLElement): void {
    container.querySelectorAll(".edf-selection-checkbox").forEach(element => element.remove());
}

function syncSelectionControls(container: HTMLElement): void {
    removeSelectionControls(container);

    for (const card of getUserListingCards(container)) {
        const id = getUserListingUrl(card);
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

function resizeInlineNote(editor: HTMLTextAreaElement): void {
    editor.style.height = "auto";
    editor.style.height = `${Math.min(editor.scrollHeight, NOTE_MAX_HEIGHT)}px`;
}

async function saveInlineNote(card: HTMLElement, editor: HTMLTextAreaElement): Promise<void> {
    const value = editor.value.trim();
    if (noteValues.get(editor) === value) return;

    findCardButton(card, "Edit Notes")?.click();
    await new Promise<void>(resolve => requestAnimationFrame(() => requestAnimationFrame(() => resolve())));

    const nativeEditor = [...card.querySelectorAll<HTMLTextAreaElement>("textarea")]
        .find(textarea => textarea !== editor) ??
        card.querySelector<HTMLTextAreaElement>("textarea");
    if (!nativeEditor) return;

    setNativeTextareaValue(nativeEditor, value);
    findCardButton(card, "Save Notes")?.click();
    noteValues.set(editor, value);
}

function configureInlineNote(card: HTMLElement): void {
    const textarea = card.querySelector<HTMLTextAreaElement>("textarea:not(.edf-inline-note)");
    if (!textarea?.disabled) return;

    textarea.classList.add("edf-inline-note");
    textarea.disabled = false;
    textarea.readOnly = false;
    textarea.removeAttribute("aria-readonly");
    noteValues.set(textarea, textarea.value.trim());

    for (const type of ["pointerdown", "mousedown", "click", "dblclick"] as const) {
        textarea.addEventListener(type, event => {
            event.stopImmediatePropagation();
            event.stopPropagation();
        }, { capture: true });
    }

    textarea.addEventListener("input", () => resizeInlineNote(textarea));
    textarea.addEventListener("blur", () => void saveInlineNote(card, textarea));
    textarea.addEventListener("keydown", event => {
        if ((event.metaKey || event.ctrlKey) && event.key === "Enter") textarea.blur();
    });
    requestAnimationFrame(() => resizeInlineNote(textarea));
}

function configureCards(container: HTMLElement): void {
    syncSelectionControls(container);
    getUserListingCards(container).forEach(configureInlineNote);
}

function clearCards(container: HTMLElement, ids: readonly string[]): void {
    const selected = new Set(ids);

    for (const card of getUserListingCards(container)) {
        const id = getUserListingUrl(card);
        if (!id || !selected.has(id)) continue;

        card.querySelector<HTMLButtonElement>('[data-testid="listing-card-shortlist-shortlisted"]')?.click();
    }
}

async function blacklistCards(container: HTMLElement, ids: readonly string[]): Promise<void> {
    const selected = new Set(ids);
    const blacklist = await getBlacklist();

    for (const card of getUserListingCards(container)) {
        const id = getUserListingUrl(card);
        if (!id || !selected.has(id) || isBlacklisted(blacklist, id)) continue;

        await toggleBlacklistListing(getListingSnapshot(card, id));
        card.querySelector<HTMLButtonElement>('[data-testid="listing-card-shortlist-shortlisted"]')?.click();
    }
}

function renderControls(container: HTMLElement): void {
    const cards = getUserListingCards(container);
    const controls = getPageActions({
        id: "shortlist",
        container,
        fallbackAnchor: cards[0]?.parentElement instanceof HTMLElement
            ? cards[0].parentElement
            : container,
    });
    const visibleIds = getUserListingUrls(cards);

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
            replaceSelection(selectedCardIds, ids);
            renderControls(container);
            configureCards(container);
        },
        selectedIds: [...selectedCardIds],
        visibleIds,
    });
}

const mountShortlistPage: PageMount = async (context) => {
    bindListingCards(context, { showBlacklistedView: false });
    const container = findUserListingsContainer();
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
