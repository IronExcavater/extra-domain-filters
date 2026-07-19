import {
    addBlacklistEntry,
    getBlacklistListing,
    removeBlacklistEntry,
    type BlacklistEntry,
    type ListingSnapshot,
} from "../domain/matching";
import { PageMount } from "../shared/platform/router";
import { getFromStorage, onStorageChange, setInStorage } from "../shared/platform/storage";
import {
    replaceWithBathIcon,
    replaceWithBedIcon,
    replaceWithBinIcon,
    replaceWithParkingIcon,
    replaceWithUnbinIcon,
} from "../shared/ui/icons";

const NOTES_KEY = "blacklistNotes";

type NotesByUrl = Record<string, string>;

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
    list.className = "edf-blacklist-row-list";
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
        sort.parentElement.insertBefore(controls, sort);
    } else {
        list.before(controls);
    }

    return controls;
}

function getDomainButtonClass(container: HTMLElement): string | undefined {
    return container.querySelector<HTMLButtonElement>('[data-testid="listing-card-buttons-wrapper"] button')
        ?.className;
}

function createFeatureBadge(
    replace: (svg: SVGSVGElement) => void,
    value: string | undefined,
): HTMLElement | undefined {
    if (!value) return undefined;

    const badge = document.createElement("span");
    badge.className = "edf-blacklist-card-feature";

    const icon = document.createElementNS("http://www.w3.org/2000/svg", "svg");
    icon.setAttribute("width", "14");
    icon.setAttribute("height", "14");
    icon.setAttribute("aria-hidden", "true");
    replace(icon);

    const label = document.createElement("span");
    label.textContent = value;

    badge.append(icon, label);
    return badge;
}

async function toggleBlacklistEntry(listing: ListingSnapshot, active: boolean): Promise<void> {
    const current = (await getFromStorage<BlacklistEntry[]>("blacklist")) ?? [];
    await setInStorage(
        "blacklist",
        active
            ? removeBlacklistEntry(current, listing.url)
            : addBlacklistEntry(current, listing),
    );
}

async function saveNote(url: string, note: string): Promise<void> {
    const notes = (await getFromStorage<NotesByUrl>(NOTES_KEY)) ?? {};
    const next = { ...notes };

    if (note.trim()) next[url] = note.trim();
    else delete next[url];

    await setInStorage(NOTES_KEY, next);
}

function createNotesControl(listing: ListingSnapshot, note: string | undefined): HTMLElement {
    const wrapper = document.createElement("div");
    wrapper.className = "edf-blacklist-card-notes";

    const text = document.createElement("textarea");
    text.className = "edf-blacklist-card-note-input";
    text.placeholder = "Add notes";
    text.value = note ?? "";
    text.hidden = true;

    const button = document.createElement("button");
    button.type = "button";
    button.className = "edf-blacklist-row-button";
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

    wrapper.append(text, button);
    return wrapper;
}

function createBlacklistRow(
    entry: BlacklistEntry,
    note: string | undefined,
): HTMLElement {
    const listing = getBlacklistListing(entry);
    const active = !entry.removedAt;
    const card = document.createElement("article");
    card.className = "edf-blacklist-card";
    card.dataset.active = String(active);
    card.setAttribute("data-testid", "extra-domain-filters-blacklist-row");

    const link = document.createElement("a");
    link.className = "edf-blacklist-card-media";
    link.href = listing.url;

    if (listing.thumbnailUrl) {
        const thumbnail = document.createElement("img");
        thumbnail.className = "edf-blacklist-card-thumbnail";
        thumbnail.src = listing.thumbnailUrl;
        thumbnail.alt = listing.displayAddress ?? listing.title;
        thumbnail.loading = "lazy";
        link.append(thumbnail);
    }

    const body = document.createElement("div");
    body.className = "edf-blacklist-card-body";

    const address = document.createElement("a");
    address.className = "edf-blacklist-card-address";
    address.href = listing.url;
    address.textContent = listing.displayAddress ?? listing.title;
    body.append(address);

    if (listing.price) {
        const price = document.createElement("div");
        price.className = "edf-blacklist-card-price";
        price.textContent = listing.price;
        body.append(price);
    }

    const features = [
        createFeatureBadge(replaceWithBedIcon, listing.features?.bedrooms),
        createFeatureBadge(replaceWithBathIcon, listing.features?.bathrooms),
        createFeatureBadge(replaceWithParkingIcon, listing.features?.parking),
    ].filter((feature): feature is HTMLElement => feature !== undefined);

    if (features.length > 0) {
        const featureRow = document.createElement("div");
        featureRow.className = "edf-blacklist-card-features";
        featureRow.append(...features);
        body.append(featureRow);
    }

    const actions = document.createElement("div");
    actions.className = "edf-blacklist-card-actions";

    const enquire = document.createElement("a");
    enquire.className = "edf-blacklist-row-button";
    enquire.href = listing.url;
    enquire.textContent = "Enquire";
    actions.append(enquire);

    const notes = createNotesControl(listing, note);
    actions.append(notes);

    const button = document.createElement("button");
    button.type = "button";
    button.className = "edf-blacklist-row-button edf-blacklist-card-button";
    button.dataset.active = String(active);
    button.setAttribute("aria-pressed", String(active));
    button.ariaLabel = active ? "Unblacklist" : "Re-blacklist";
    button.title = button.ariaLabel;

    const icon = document.createElementNS("http://www.w3.org/2000/svg", "svg");
    icon.setAttribute("width", "16");
    icon.setAttribute("height", "16");
    icon.setAttribute("aria-hidden", "true");
    (active ? replaceWithUnbinIcon : replaceWithBinIcon)(icon);
    button.append(icon);

    button.addEventListener("click", () => {
        void toggleBlacklistEntry(listing, active);
    });
    actions.append(button);

    body.append(actions);
    card.append(link, body);

    return card;
}

async function render(container: HTMLElement, list: HTMLElement): Promise<void> {
    const [all = [], notes = {}] = await Promise.all([
        getFromStorage<BlacklistEntry[]>("blacklist"),
        getFromStorage<NotesByUrl>(NOTES_KEY),
    ]);
    const entries = [...all].sort((first, second) => second.addedAt - first.addedAt);

    const controls = getControls(container, list);
    const message = container.querySelector<HTMLElement>('[data-testid="shortlist__message_wrapper"]');

    const clearButton = document.createElement("button");
    clearButton.type = "button";
    clearButton.className = [getDomainButtonClass(container), "edf-blacklist-clear-button"]
        .filter(Boolean)
        .join(" ");
    clearButton.textContent = "Clear all";
    clearButton.disabled = all.length === 0;
    clearButton.addEventListener("click", () => {
        void setInStorage("blacklist", []);
    });

    controls.replaceChildren(clearButton);

    if (message) {
        message.hidden = entries.length > 0;
        if (entries.length === 0) {
            message.textContent = "No blacklisted properties yet.";
        }
    }

    list.replaceChildren(...entries.map(entry => createBlacklistRow(entry, notes[entry.url])));
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
