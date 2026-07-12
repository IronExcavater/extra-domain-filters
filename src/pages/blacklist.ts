import { replaceWithBinIcon } from "../core/icons";
import { PageMount } from "../core/router";
import { getFromStorage, onStorageChange, setInStorage } from "../core/storage";
import {
    addBlacklistEntry,
    getBlacklistListing,
    removeBlacklistEntry,
    type BlacklistEntry,
} from "../matching";

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

// The blacklist view shares Domain's own /user/shortlist route and DOM (there's no separate
// page for it), so mounting/unmounting must only ever hide or restore that shared DOM — never
// replace or rename its nodes. Doing so previously left React's real shortlist list corrupted
// (its children swapped out from under it) once the user navigated back to the normal view.
function setTitle(container: HTMLElement): () => void {
    const title = container.querySelector<HTMLElement>(
        '[data-testid="shortlist__title"], h1, h2',
    );
    if (!title) return () => undefined;

    const original = title.textContent;
    title.textContent = "Your blacklist";

    return () => { title.textContent = original; };
}

function findListContainer(container: HTMLElement): { list: HTMLElement; restore: () => void } {
    const existing = container.querySelector<HTMLElement>(
        '[data-testid="extra-domain-filters-blacklist-list"]',
    );
    if (existing) return { list: existing, restore: () => undefined };

    // Our rows are plain text, not photo cards, so this deliberately does NOT inherit Domain's
    // own list layout class (that's a photo-card grid, wrong shape for a row list).
    const realList = container
        .querySelector('[data-testid="listing-card-container"]')
        ?.parentElement;

    const list = document.createElement("div");
    list.className = "edf-blacklist-row-list";
    list.setAttribute("data-testid", "extra-domain-filters-blacklist-list");

    if (realList instanceof HTMLElement) {
        // Hide (not remove) the real list so it's untouched when we unmount. The `hidden`
        // attribute alone isn't enough — Domain's own class sets `display` directly, and author
        // styles always win over the `[hidden] { display: none }` user-agent rule regardless of
        // specificity, so the real cards stayed visible underneath. An inline !important style
        // outranks that author rule too.
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
    const element = container.querySelector<HTMLElement>(
        '[data-testid="shortlist__message_wrapper"]',
    );
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

// Deliberately doesn't surface the address/price/features — the row is just a title, keeping
// the full listing snapshot in storage (via getBlacklistListing) so re-blacklisting after an
// accidental undo restores it, without displaying what was blacklisted.
function createBlacklistRow(entry: BlacklistEntry, active: boolean): HTMLElement {
    const listing = getBlacklistListing(entry);

    const row = document.createElement("div");
    row.className = "edf-blacklist-row";
    row.dataset.active = String(active);
    row.setAttribute("data-testid", "extra-domain-filters-blacklist-row");

    const title = document.createElement("div");
    title.className = "edf-blacklist-row-title";

    const icon = document.createElementNS("http://www.w3.org/2000/svg", "svg");
    icon.classList.add("edf-blacklist-row-icon");
    icon.setAttribute("width", "18");
    icon.setAttribute("height", "18");
    icon.setAttribute("aria-hidden", "true");
    replaceWithBinIcon(icon);

    const label = document.createElement("span");
    label.textContent = "Blacklisted property";

    title.append(icon, label);

    if (entry.addedAt > 0) {
        const date = document.createElement("small");
        date.className = "edf-blacklist-row-date";
        date.textContent = new Date(entry.addedAt).toLocaleDateString();
        title.append(date);
    }

    const button = document.createElement("button");
    button.type = "button";
    button.className = "edf-blacklist-row-button";
    button.dataset.active = String(active);
    button.textContent = active ? "Unblacklist" : "Re-blacklist";
    button.setAttribute("aria-pressed", String(active));
    button.addEventListener("click", async () => {
        const current = (await getFromStorage<BlacklistEntry[]>("blacklist")) ?? [];
        await setInStorage(
            "blacklist",
            active
                ? removeBlacklistEntry(current, listing.url)
                : addBlacklistEntry(current, listing),
        );
    });

    row.append(title, button);

    return row;
}

async function render(container: HTMLElement, list: HTMLElement): Promise<void> {
    const all = (await getFromStorage<BlacklistEntry[]>("blacklist")) ?? [];
    const entries = [...all].sort((first, second) => second.addedAt - first.addedAt);

    const controls = getControls(container, list);
    const message = container.querySelector<HTMLElement>(
        '[data-testid="shortlist__message_wrapper"]',
    );

    const clearButton = document.createElement("button");
    clearButton.type = "button";
    clearButton.className = "edf-blacklist-clear-button";
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

    list.replaceChildren(
        ...entries.map(entry => createBlacklistRow(entry, !entry.removedAt)),
    );
}

const mountBlacklistPage: PageMount = async (context) => {
    const container = await waitForShortlistContainer(context.signal);
    const restoreTitle = setTitle(container);
    const restoreMessage = findMessage(container);
    const { list, restore: restoreList } = findListContainer(container);

    await render(container, list);

    const unwatch = onStorageChange<BlacklistEntry[]>(
        "blacklist",
        () => void render(container, list),
    );

    context.signal.addEventListener("abort", () => {
        unwatch();
        container.querySelector('[data-testid="extra-domain-filters-blacklist-controls"]')?.remove();
        restoreMessage();
        restoreTitle();
        restoreList();
    }, { once: true });
};

export default mountBlacklistPage;
