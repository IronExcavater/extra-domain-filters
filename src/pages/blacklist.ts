import { getBlacklist, removeBlacklistUrls, toggleBlacklistListing } from "../domain/blacklist/store";
import { getBlacklistListing, type BlacklistEntry } from "../domain/matching";
import {
    cloneBlacklistButton,
    SHORTLIST_CARD_BUTTON_SKIN,
    setBlacklistButtonState,
} from "../features/listing-cards/clone/blacklistButton";
import { createShortlistSnapshotCard } from "../features/listing-cards/render/shortlistSnapshot";
import {
    getPageActions,
    overridePageTitle,
    restorePageActions,
    waitForUserListingsContainer,
} from "../features/user-listings/page";
import { PageMount } from "../shared/platform/router";
import { onStorageChange } from "../shared/platform/storage";
import { createSelectionCheckbox, renderSelectionControls, replaceSelection } from "../shared/ui/selection";

const ACTION_BUTTON_CLASS = "css-8vgasn edf-action-button";

const selectedUrls = new Set<string>();

function getRowKey(entry: BlacklistEntry): string {
    return getBlacklistListing(entry).url;
}

function getRowVersion(entry: BlacklistEntry): string {
    return JSON.stringify({
        active: !entry.removedAt,
        removedAt: entry.removedAt ?? null,
    });
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

function findCardTemplate(container: HTMLElement): HTMLElement | undefined {
    return container.querySelector<HTMLElement>(
        '[data-testid="listing-card-container"]:not([data-edf-blacklist-row])',
    ) ?? undefined;
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

function createSelectionInput(url: string, onChange: () => void): HTMLLabelElement {
    return createSelectionCheckbox(
        selectedUrls.has(url),
        "Select blacklisted listing",
        checked => {
            if (checked) selectedUrls.add(url);
            else selectedUrls.delete(url);
            onChange();
        },
    );
}

function createBlacklistRow(
    entry: BlacklistEntry,
    onSelectionChange: () => void,
    template?: HTMLElement,
): HTMLElement {
    const listing = getBlacklistListing(entry);
    const active = !entry.removedAt;
    const sourceButton = template?.querySelector<HTMLButtonElement>('[data-testid^="listing-card-shortlist"]');
    const button = sourceButton
        ? cloneBlacklistButton(sourceButton, {
            appearance: "shortlist",
            skin: SHORTLIST_CARD_BUTTON_SKIN,
        })
        : document.createElement("button");
    const card = createShortlistSnapshotCard(listing, { blacklistButton: button }, template);

    card.dataset.active = String(active);
    card.dataset.edfBlacklistRow = "true";
    card.dataset.edfBlacklistUrl = listing.url;
    card.dataset.edfBlacklistVersion = getRowVersion(entry);
    const priceRow = card.querySelector<HTMLElement>('[data-testid="listing-card-price-wrapper"]') ??
        card;
    priceRow.classList.add("edf-listing-card-button-container");
    priceRow.prepend(createSelectionInput(listing.url, onSelectionChange));

    button.type = "button";
    button.className = `${SHORTLIST_CARD_BUTTON_SKIN.active} edf-blacklist-button`;
    button.dataset.edfInactiveClass = SHORTLIST_CARD_BUTTON_SKIN.inactive;
    button.dataset.edfActiveClass = SHORTLIST_CARD_BUTTON_SKIN.active;
    button.dataset.edfButtonSkin = "shortlist";
    button.setAttribute("data-testid", "extra-domain-filters-blacklist-toggle");
    setBlacklistButtonState(button, active, "Re-blacklist");
    button.addEventListener("click", event => {
        event.preventDefault();
        event.stopPropagation();
        event.stopImmediatePropagation();
        void toggleBlacklistListing(listing);
    }, { capture: true });

    return card;
}

function reconcileRows(
    container: HTMLElement,
    list: HTMLElement,
    entries: BlacklistEntry[],
    template?: HTMLElement,
): void {
    const existingRows = new Map(
        [...list.querySelectorAll<HTMLElement>('[data-edf-blacklist-row="true"]')]
            .map(row => [row.dataset.edfBlacklistUrl, row] as const)
            .filter((entry): entry is [string, HTMLElement] => entry[0] !== undefined),
    );

    const rows = entries.map(entry => {
        const url = getRowKey(entry);
        const version = getRowVersion(entry);
        const existing = existingRows.get(url);

        if (existing?.dataset.edfBlacklistVersion === version) {
            const input = existing.querySelector<HTMLInputElement>('.edf-selection-checkbox input');
            if (input) input.checked = selectedUrls.has(url);
            return existing;
        }

        return createBlacklistRow(entry, () => void render(container, list, template), template);
    });

    list.replaceChildren(...rows);
}

async function render(
    container: HTMLElement,
    list: HTMLElement,
    template?: HTMLElement,
): Promise<void> {
    const all = await getBlacklist();
    const entries = all
        .filter(entry => !entry.removedAt)
        .sort((first, second) => second.addedAt - first.addedAt);

    const controls = getPageActions({ id: "blacklist", container, fallbackAnchor: list });
    const message = container.querySelector<HTMLElement>('[data-testid="shortlist__message_wrapper"]');

    renderSelectionControls({
        buttonClassName: ACTION_BUTTON_CLASS,
        clearLabel: "Unblacklist",
        controls,
        onClear: ids => {
            void removeBlacklistUrls(ids);
        },
        onSelectionChange: ids => {
            replaceSelection(selectedUrls, ids);
            void render(container, list);
        },
        selectedIds: [...selectedUrls],
        visibleIds: entries.map(getRowKey),
    });

    if (message) {
        message.hidden = entries.length > 0;
        if (entries.length === 0) {
            message.textContent = "No blacklisted properties yet.";
        }
    }

    reconcileRows(container, list, entries, template);
}

const mountBlacklistPage: PageMount = async (context) => {
    const container = await waitForUserListingsContainer(context.signal);
    const restoreTitle = overridePageTitle(container, "Blacklisted properties");
    const restoreMessage = findMessage(container);
    const template = findCardTemplate(container);
    const { list, restore: restoreList } = findListContainer(container);

    await render(container, list, template);

    const unwatchBlacklist = onStorageChange<BlacklistEntry[]>(
        "blacklist",
        () => void render(container, list, template),
    );

    context.signal.addEventListener("abort", () => {
        unwatchBlacklist();
        restorePageActions(container, "blacklist");
        restoreMessage();
        restoreTitle();
        restoreList();
    }, { once: true });
};

export default mountBlacklistPage;
