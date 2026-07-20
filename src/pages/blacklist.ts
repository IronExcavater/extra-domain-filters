import { clearBlacklist, getBlacklist, removeBlacklistUrls, toggleBlacklistListing } from "../domain/blacklist/store";
import { getBlacklistListing, type BlacklistEntry } from "../domain/matching";
import { SHORTLIST_CARD_BUTTON_SKIN, setBlacklistButtonState } from "../features/listing-cards/blacklist/button";
import { createShortlistSnapshotCard } from "../features/listing-cards/render/shortlistSnapshot";
import { PageMount } from "../shared/platform/router";
import { onStorageChange } from "../shared/platform/storage";

const RESET_FILTER_BUTTON_CLASS = "css-8vgasn";

const selectedUrls = new Set<string>();
let selectionMode = false;

function getRowKey(entry: BlacklistEntry): string {
    return getBlacklistListing(entry).url;
}

function getRowVersion(entry: BlacklistEntry): string {
    return JSON.stringify({
        active: !entry.removedAt,
        removedAt: entry.removedAt ?? null,
    });
}

function findShortlistContainer(): HTMLElement | undefined {
    const shortlistRoot = document.querySelector("#shortlist");
    return shortlistRoot?.firstElementChild instanceof HTMLElement
        ? shortlistRoot.firstElementChild
        : undefined;
}

function waitForShortlistContainer(signal: AbortSignal): Promise<HTMLElement> {
    const existing = findShortlistContainer();
    if (existing) return Promise.resolve(existing);

    return new Promise((resolve, reject) => {
        const observer = new MutationObserver(() => {
            const container = findShortlistContainer();
            if (!container) return;

            observer.disconnect();
            resolve(container);
        });

        signal.addEventListener("abort", () => {
            observer.disconnect();
            reject(new DOMException("Unmounted", "AbortError"));
        }, { once: true });

        observer.observe(document.body, { childList: true, subtree: true });
    });
}

function setTitle(container: HTMLElement): () => void {
    const title = container.querySelector<HTMLElement>('[data-testid="shortlist__title"], h1, h2');
    if (!title) return () => undefined;

    const original = title.textContent;
    title.textContent = "Blacklisted properties";

    return () => {
        title.textContent = original;
    };
}

function findListContainer(container: HTMLElement): { list: HTMLElement; restore: () => void } {
    const existing = container.querySelector<HTMLElement>('[data-testid="extra-domain-filters-blacklist-list"]');
    if (existing) return { list: existing, restore: () => undefined };

    const realList = container
        .querySelector('[data-testid="listing-card-container"]')
        ?.parentElement;
    const list = document.createElement("div");
    list.className = realList instanceof HTMLElement
        ? `${realList.className} edf-blacklist-row-list`
        : "edf-blacklist-row-list";
    list.setAttribute("data-testid", "extra-domain-filters-blacklist-list");

    if (realList instanceof HTMLElement) {
        realList.style.setProperty("display", "none", "important");
        realList.after(list);

        return {
            list,
            restore: () => {
                realList.style.removeProperty("display");
                list.remove();
            },
        };
    }

    const message = container.querySelector('[data-testid="shortlist__message_wrapper"]');
    if (message) message.after(list);
    else container.append(list);

    return { list, restore: () => list.remove() };
}

function findMessage(container: HTMLElement): () => void {
    const element = container.querySelector<HTMLElement>('[data-testid="shortlist__message_wrapper"]');
    if (!element) return () => undefined;

    const originalHidden = element.hidden;
    const originalText = element.textContent;

    return () => {
        element.hidden = originalHidden;
        element.textContent = originalText;
    };
}

function getControls(container: HTMLElement, list: HTMLElement): HTMLDivElement {
    const existing = container.querySelector<HTMLDivElement>(
        '[data-testid="extra-domain-filters-blacklist-controls"]',
    );
    if (existing) return existing;

    const controls = document.createElement("div");
    controls.className = "edf-blacklist-page-controls";
    controls.setAttribute("data-testid", "extra-domain-filters-blacklist-controls");

    const sort = container.querySelector('[data-testid="listing-tabs__filters-sort-by"]');
    if (sort?.parentElement) {
        const label = document.createElement("span");
        label.className = "edf-blacklist-sort-label";
        label.textContent = "Sort by";
        sort.classList.add("edf-blacklist-sort-control");
        sort.parentElement.insertBefore(controls, sort);
        sort.parentElement.insertBefore(label, sort);
    } else {
        list.before(controls);
    }

    return controls;
}

function createSelectionInput(url: string): HTMLLabelElement {
    const label = document.createElement("label");
    const input = document.createElement("input");

    label.className = "edf-selection-checkbox";
    input.type = "checkbox";
    input.checked = selectedUrls.has(url);
    input.ariaLabel = "Select blacklisted listing";
    input.addEventListener("change", () => {
        if (input.checked) selectedUrls.add(url);
        else selectedUrls.delete(url);
    });
    label.append(input);

    return label;
}

function createBlacklistRow(entry: BlacklistEntry): HTMLElement {
    const listing = getBlacklistListing(entry);
    const active = !entry.removedAt;
    const button = document.createElement("button");
    const card = createShortlistSnapshotCard(listing, { blacklistButton: button });

    card.dataset.active = String(active);
    card.dataset.edfBlacklistRow = "true";
    card.dataset.edfBlacklistUrl = listing.url;
    card.dataset.edfBlacklistVersion = getRowVersion(entry);
    card.setAttribute("data-testid", "extra-domain-filters-blacklist-row");
    if (selectionMode) card.prepend(createSelectionInput(listing.url));

    button.type = "button";
    button.className = `${SHORTLIST_CARD_BUTTON_SKIN.active} edf-blacklist-button`;
    button.dataset.edfInactiveClass = SHORTLIST_CARD_BUTTON_SKIN.inactive;
    button.dataset.edfActiveClass = SHORTLIST_CARD_BUTTON_SKIN.active;
    button.setAttribute("data-testid", "extra-domain-filters-blacklist-toggle");
    setBlacklistButtonState(button, active, "Re-blacklist");
    button.addEventListener("click", event => {
        event.preventDefault();
        event.stopPropagation();
        void toggleBlacklistListing(listing);
    });

    return card;
}

function reconcileRows(
    container: HTMLElement,
    list: HTMLElement,
    entries: BlacklistEntry[],
): void {
    const existingRows = new Map(
        [...list.querySelectorAll<HTMLElement>('[data-testid="extra-domain-filters-blacklist-row"]')]
            .map(row => [row.dataset.edfBlacklistUrl, row] as const)
            .filter((entry): entry is [string, HTMLElement] => entry[0] !== undefined),
    );

    const rows = entries.map(entry => {
        const url = getRowKey(entry);
        const version = getRowVersion(entry);
        const existing = existingRows.get(url);

        if (existing?.dataset.edfBlacklistVersion === version) {
            return existing;
        }

        return createBlacklistRow(entry);
    });

    list.replaceChildren(...rows);
}

async function render(container: HTMLElement, list: HTMLElement): Promise<void> {
    const all = await getBlacklist();
    const entries = [...all].sort((first, second) => second.addedAt - first.addedAt);

    const controls = getControls(container, list);
    const message = container.querySelector<HTMLElement>('[data-testid="shortlist__message_wrapper"]');

    const clearButton = document.createElement("button");
    const selectionButton = document.createElement("button");
    const selectAllButton = document.createElement("button");
    clearButton.type = "button";
    clearButton.className = `${RESET_FILTER_BUTTON_CLASS} edf-blacklist-clear-button`;
    clearButton.ariaLabel = "Clear all blacklist selections";
    clearButton.textContent = selectionMode ? "Clear selected" : "Clear all";
    clearButton.disabled = selectionMode ? selectedUrls.size === 0 : all.length === 0;
    clearButton.addEventListener("click", () => {
        if (!selectionMode) {
            void clearBlacklist();
            return;
        }

        void removeBlacklistUrls([...selectedUrls]).then(() => selectedUrls.clear());
    });

    selectionButton.type = "button";
    selectionButton.className = `${RESET_FILTER_BUTTON_CLASS} edf-blacklist-clear-button`;
    selectionButton.textContent = selectionMode ? "Cancel selection" : "Select";
    selectionButton.addEventListener("click", () => {
        selectionMode = !selectionMode;
        if (!selectionMode) selectedUrls.clear();
        void render(container, list);
    });

    selectAllButton.type = "button";
    selectAllButton.className = `${RESET_FILTER_BUTTON_CLASS} edf-blacklist-clear-button`;
    selectAllButton.textContent = selectedUrls.size === entries.length ? "Deselect all" : "Select all";
    selectAllButton.hidden = !selectionMode;
    selectAllButton.addEventListener("click", () => {
        if (selectedUrls.size === entries.length) selectedUrls.clear();
        else for (const entry of entries) selectedUrls.add(getRowKey(entry));
        void render(container, list);
    });

    controls.replaceChildren(selectionButton, selectAllButton, clearButton);

    if (message) {
        message.hidden = entries.length > 0;
        if (entries.length === 0) {
            message.textContent = "No blacklisted properties yet.";
        }
    }

    reconcileRows(container, list, entries);
}

const mountBlacklistPage: PageMount = async (context) => {
    const container = await waitForShortlistContainer(context.signal);
    const restoreTitle = setTitle(container);
    const restoreMessage = findMessage(container);
    const { list, restore: restoreList } = findListContainer(container);

    await render(container, list);

    const unwatchBlacklist = onStorageChange<BlacklistEntry[]>(
        "blacklist",
        () => void render(container, list),
    );

    context.signal.addEventListener("abort", () => {
        unwatchBlacklist();
        container.querySelector('[data-testid="extra-domain-filters-blacklist-controls"]')?.remove();
        restoreMessage();
        restoreTitle();
        restoreList();
    }, { once: true });
};

export default mountBlacklistPage;
