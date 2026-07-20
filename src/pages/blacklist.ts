import { clearBlacklist, getBlacklist, toggleBlacklistListing } from "../domain/blacklist/store";
import { getBlacklistListing, type BlacklistEntry, type ListingSnapshot } from "../domain/matching";
import { cloneBlacklistButton, setBlacklistButtonState } from "../features/listing-cards/blacklist/button";
import { PageMount } from "../shared/platform/router";
import { getFromStorage, onStorageChange, setInStorage } from "../shared/platform/storage";

const NOTES_KEY = "blacklistNotes";
const RESET_FILTER_BUTTON_CLASS = "css-8vgasn";

type NotesByUrl = Record<string, string>;

function getRowKey(entry: BlacklistEntry): string {
    return getBlacklistListing(entry).url;
}

function getRowVersion(entry: BlacklistEntry, note: string | undefined): string {
    return JSON.stringify({
        active: !entry.removedAt,
        note: note ?? "",
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
    title.textContent = "Your blacklist";

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
        sort.classList.add("edf-blacklist-sort-control");
        sort.parentElement.insertBefore(controls, sort);
    } else {
        list.before(controls);
    }

    return controls;
}

function getDomainButtonClass(container: HTMLElement): string {
    void container;
    return RESET_FILTER_BUTTON_CLASS;
}

function getTemplateCard(container: HTMLElement): HTMLElement | undefined {
    return container.querySelector<HTMLElement>(
        '[data-testid="listing-card-container"]:not([data-edf-blacklist-row="true"])',
    ) ?? undefined;
}

async function saveNote(url: string, note: string): Promise<void> {
    const notes = (await getFromStorage<NotesByUrl>(NOTES_KEY)) ?? {};
    const next = { ...notes };

    if (note.trim()) next[url] = note.trim();
    else delete next[url];

    await setInStorage(NOTES_KEY, next);
}

function createOwnedNotesControl(listing: ListingSnapshot, note: string | undefined, buttonClass: string): HTMLElement {
    const wrapper = document.createElement("div");
    const fieldWrapper = document.createElement("div");
    const text = document.createElement("textarea");
    const button = document.createElement("button");

    wrapper.className = "edf-blacklist-owned-notes";
    fieldWrapper.className = "edf-blacklist-owned-note-field";

    text.className = "text-input__input is-small";
    text.placeholder = "Add notes";
    text.value = note ?? "";
    text.hidden = true;

    button.type = "button";
    button.className = buttonClass;
    button.textContent = note ? "Edit notes" : "Add notes";

    button.addEventListener("click", () => {
        if (text.hidden) {
            text.hidden = false;
            button.textContent = "Save Notes";
            text.focus();
            return;
        }

        void saveNote(listing.url, text.value).then(() => {
            text.hidden = true;
            button.textContent = text.value.trim() ? "Edit notes" : "Add notes";
        });
    });

    fieldWrapper.append(text);
    wrapper.append(fieldWrapper, button);
    return wrapper;
}

function createEnquireLink(listing: ListingSnapshot, buttonClass: string): HTMLAnchorElement {
    const link = document.createElement("a");

    link.className = buttonClass;
    link.href = listing.url;
    link.textContent = "Enquire";

    return link;
}

function getVisibleText(value: string | undefined, fallback = ""): string {
    return value?.trim() || fallback;
}

function setLinkUrls(card: HTMLElement, url: string): void {
    for (const anchor of card.querySelectorAll<HTMLAnchorElement>("a[href]")) {
        anchor.href = url;
    }
}

function setListingImage(card: HTMLElement, listing: ListingSnapshot): void {
    const carousel = card.querySelector<HTMLElement>('[data-testid="listing-card-carousel"]');
    const sourceAnchor = carousel?.querySelector<HTMLAnchorElement>("a") ??
        card.querySelector<HTMLAnchorElement>("a:has(img)");
    const sourceImageWrapper = card.querySelector<HTMLElement>('[data-testid="listing-card-lazy-image"]');

    if (carousel) {
        const anchor = document.createElement("a");
        const imageWrapper = document.createElement("div");

        anchor.href = listing.url;
        anchor.className = sourceAnchor?.className ?? "";
        anchor.style.width = "100%";
        anchor.style.display = "inline-block";
        imageWrapper.className = sourceImageWrapper?.className ?? "";
        imageWrapper.setAttribute("data-testid", "listing-card-lazy-image");

        if (listing.thumbnailUrl) {
            const image = document.createElement("img");

            image.src = listing.thumbnailUrl;
            image.alt = listing.displayAddress ?? listing.title;
            image.loading = "lazy";
            imageWrapper.append(image);
        }

        anchor.append(imageWrapper);
        carousel.replaceChildren(anchor);
        return;
    }

    const images = [...card.querySelectorAll<HTMLImageElement>("img")];
    if (!listing.thumbnailUrl) {
        for (const image of images) image.remove();
        return;
    }

    for (const image of images) {
        image.src = listing.thumbnailUrl;
        image.srcset = "";
        image.alt = listing.displayAddress ?? listing.title;
        image.loading = "lazy";
    }
}

function setTextIfPresent(card: HTMLElement, selector: string, value: string | undefined): void {
    const element = card.querySelector<HTMLElement>(selector);
    if (element && value) element.textContent = value;
}

function setFeatureText(card: HTMLElement, selector: string, value: string | undefined): void {
    if (!value) return;

    const element = card.querySelector<HTMLElement>(selector);
    if (element) element.textContent = value;
}

function removeTimeSensitiveListingState(card: HTMLElement): void {
    card.querySelector('[data-testid="listing-card-tag"]')?.remove();
    for (const arrow of card.querySelectorAll(".slick-arrow")) {
        arrow.remove();
    }
}

function replaceNotesControls(
    container: HTMLElement,
    card: HTMLElement,
    listing: ListingSnapshot,
    note: string | undefined,
): void {
    const existingActions = card.querySelector<HTMLElement>('[data-testid="listing-card-buttons-wrapper"]');
    const actions = existingActions ?? document.createElement("div");
    const buttonClass = existingActions?.querySelector<HTMLButtonElement>("button")?.className ??
        getDomainButtonClass(container);
    const blacklistButton = card.querySelector<HTMLButtonElement>(
        '[data-testid="extra-domain-filters-blacklist-toggle"]',
    );
    const notes = createOwnedNotesControl(listing, note, buttonClass);
    const enquire = createEnquireLink(listing, buttonClass);

    if (!existingActions) {
        actions.setAttribute("data-testid", "listing-card-buttons-wrapper");
    }

    actions.replaceChildren(enquire, notes);
    if (blacklistButton) actions.append(blacklistButton);

    if (!existingActions) card.append(actions);
}

function replaceBlacklistToggle(card: HTMLElement, listing: ListingSnapshot, active: boolean): void {
    const sourceButton = card.querySelector<HTMLButtonElement>('[data-testid^="listing-card-shortlist"]') ??
        card.querySelector<HTMLButtonElement>("button");
    if (!sourceButton) return;

    const button = cloneBlacklistButton(sourceButton);

    button.setAttribute("data-testid", "extra-domain-filters-blacklist-toggle");
    setBlacklistButtonState(button, active, "Re-blacklist");
    button.addEventListener("click", event => {
        event.preventDefault();
        event.stopPropagation();
        void toggleBlacklistListing(listing);
    });
    sourceButton.replaceWith(button);
}

function createShortlistStyledBlacklistRow(
    container: HTMLElement,
    template: HTMLElement,
    entry: BlacklistEntry,
    note: string | undefined,
): HTMLElement {
    const listing = getBlacklistListing(entry);
    const active = !entry.removedAt;
    const card = template.cloneNode(true) as HTMLElement;

    card.dataset.active = String(active);
    card.dataset.edfBlacklistRow = "true";
    card.dataset.edfBlacklistUrl = listing.url;
    card.dataset.edfBlacklistVersion = getRowVersion(entry, note);
    card.setAttribute("data-testid", "extra-domain-filters-blacklist-row");

    setLinkUrls(card, listing.url);
    setListingImage(card, listing);
    setTextIfPresent(card, '[data-testid="address-wrapper"], [data-testid*="address"]', listing.displayAddress ?? listing.title);
    setTextIfPresent(card, '[data-testid="listing-card-price"]', listing.price);
    setFeatureText(card, '[data-testid="property-features-feature"]:nth-of-type(1) [data-testid="property-features-text-container"]', listing.features?.bedrooms);
    setFeatureText(card, '[data-testid="property-features-feature"]:nth-of-type(2) [data-testid="property-features-text-container"]', listing.features?.bathrooms);
    setFeatureText(card, '[data-testid="property-features-feature"]:nth-of-type(3) [data-testid="property-features-text-container"]', listing.features?.parking);
    removeTimeSensitiveListingState(card);
    replaceBlacklistToggle(card, listing, active);
    replaceNotesControls(container, card, listing, note);

    return card;
}

function createFallbackBlacklistRow(
    container: HTMLElement,
    entry: BlacklistEntry,
    note: string | undefined,
): HTMLElement {
    const listing = getBlacklistListing(entry);
    const active = !entry.removedAt;
    const buttonClass = getDomainButtonClass(container);
    const card = document.createElement("article");
    const media = document.createElement("a");
    const body = document.createElement("div");
    const address = document.createElement("a");
    const price = document.createElement("p");
    const actions = document.createElement("div");
    const toggle = document.createElement("button");

    card.className = "edf-blacklist-snapshot";
    card.dataset.active = String(active);
    card.dataset.edfBlacklistRow = "true";
    card.dataset.edfBlacklistUrl = listing.url;
    card.dataset.edfBlacklistVersion = getRowVersion(entry, note);
    card.setAttribute("data-testid", "extra-domain-filters-blacklist-row");

    media.className = "edf-blacklist-snapshot-media";
    media.href = listing.url;
    if (listing.thumbnailUrl) {
        const image = document.createElement("img");

        image.src = listing.thumbnailUrl;
        image.alt = listing.displayAddress ?? listing.title;
        image.loading = "lazy";
        media.append(image);
    }

    body.className = "edf-blacklist-snapshot-body";
    address.className = "edf-blacklist-snapshot-address";
    address.href = listing.url;
    address.textContent = getVisibleText(listing.displayAddress, listing.title);
    price.className = "edf-blacklist-snapshot-price";
    price.textContent = getVisibleText(listing.price);

    actions.className = "edf-blacklist-snapshot-actions";
    toggle.type = "button";
    toggle.className = `${buttonClass} edf-blacklist-button`;
    toggle.dataset.edfInactiveClass = buttonClass;
    toggle.setAttribute("data-testid", "extra-domain-filters-blacklist-toggle");
    setBlacklistButtonState(toggle, active, "Re-blacklist");
    toggle.addEventListener("click", event => {
        event.preventDefault();
        event.stopPropagation();
        void toggleBlacklistListing(listing);
    });

    actions.append(createEnquireLink(listing, buttonClass), createOwnedNotesControl(listing, note, buttonClass), toggle);
    body.append(address, price, actions);
    card.append(media, body);

    return card;
}

function reconcileRows(
    container: HTMLElement,
    list: HTMLElement,
    entries: BlacklistEntry[],
    notes: NotesByUrl,
): void {
    const template = getTemplateCard(container);
    const existingRows = new Map(
        [...list.querySelectorAll<HTMLElement>('[data-testid="extra-domain-filters-blacklist-row"]')]
            .map(row => [row.dataset.edfBlacklistUrl, row] as const)
            .filter((entry): entry is [string, HTMLElement] => entry[0] !== undefined),
    );

    const rows = entries.map(entry => {
        const url = getRowKey(entry);
        const version = getRowVersion(entry, notes[url]);
        const existing = existingRows.get(url);

        if (existing?.dataset.edfBlacklistVersion === version) {
            return existing;
        }

        return template
            ? createShortlistStyledBlacklistRow(container, template, entry, notes[url])
            : createFallbackBlacklistRow(container, entry, notes[url]);
    });

    list.replaceChildren(...rows);
}

async function render(container: HTMLElement, list: HTMLElement): Promise<void> {
    const [all = [], notes = {}] = await Promise.all([
        getBlacklist(),
        getFromStorage<NotesByUrl>(NOTES_KEY),
    ]);
    const entries = [...all].sort((first, second) => second.addedAt - first.addedAt);

    const controls = getControls(container, list);
    const message = container.querySelector<HTMLElement>('[data-testid="shortlist__message_wrapper"]');

    const clearButton = document.createElement("button");
    clearButton.type = "button";
    clearButton.className = `${RESET_FILTER_BUTTON_CLASS} edf-blacklist-clear-button`;
    clearButton.ariaLabel = "Clear all blacklist selections";
    clearButton.textContent = "Clear all";
    clearButton.disabled = all.length === 0;
    clearButton.addEventListener("click", () => {
        void clearBlacklist();
    });

    controls.replaceChildren(clearButton);

    if (message) {
        message.hidden = entries.length > 0;
        if (entries.length === 0) {
            message.textContent = "No blacklisted properties yet.";
        }
    }

    reconcileRows(container, list, entries, notes);
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
    const unwatchNotes = onStorageChange<NotesByUrl>(
        NOTES_KEY,
        () => void render(container, list),
    );

    context.signal.addEventListener("abort", () => {
        unwatchBlacklist();
        unwatchNotes();
        container.querySelector('[data-testid="extra-domain-filters-blacklist-controls"]')?.remove();
        restoreMessage();
        restoreTitle();
        restoreList();
    }, { once: true });
};

export default mountBlacklistPage;
