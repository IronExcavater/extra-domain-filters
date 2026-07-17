import { replaceWithBathIcon, replaceWithBedIcon, replaceWithBinIcon, replaceWithParkingIcon } from "../core/icons";
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

// Renders as a real card (thumbnail, address, price, features) from the listing snapshot kept
// in storage (via getBlacklistListing) — there's no live Domain card to clone here, since a
// blacklisted listing was never necessarily shortlisted, so this page has no corresponding React
// DOM to read from the way the real shortlist page does.
function createBlacklistRow(entry: BlacklistEntry, active: boolean): HTMLElement {
    const listing = getBlacklistListing(entry);

    const card = document.createElement("div");
    card.className = "edf-blacklist-card";
    card.dataset.active = String(active);
    card.setAttribute("data-testid", "extra-domain-filters-blacklist-row");

    if (listing.thumbnailUrl) {
        const thumbnail = document.createElement("img");
        thumbnail.className = "edf-blacklist-card-thumbnail";
        thumbnail.src = listing.thumbnailUrl;
        thumbnail.alt = "";
        thumbnail.loading = "lazy";
        card.append(thumbnail);
    }

    const body = document.createElement("div");
    body.className = "edf-blacklist-card-body";

    const address = document.createElement("div");
    address.className = "edf-blacklist-card-address";

    const icon = document.createElementNS("http://www.w3.org/2000/svg", "svg");
    icon.classList.add("edf-blacklist-card-icon");
    icon.setAttribute("width", "16");
    icon.setAttribute("height", "16");
    icon.setAttribute("aria-hidden", "true");
    replaceWithBinIcon(icon);

    const addressLabel = document.createElement("span");
    addressLabel.textContent = listing.displayAddress ?? listing.title;

    address.append(icon, addressLabel);
    body.append(address);

    const meta = document.createElement("div");
    meta.className = "edf-blacklist-card-meta";

    if (listing.price) {
        const price = document.createElement("span");
        price.className = "edf-blacklist-card-price";
        price.textContent = listing.price;
        meta.append(price);
    }

    if (listing.status) {
        const status = document.createElement("span");
        status.className = "edf-blacklist-card-status";
        status.textContent = listing.status;
        meta.append(status);
    }

    if (meta.childElementCount > 0) body.append(meta);

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

    if (entry.addedAt > 0) {
        const date = document.createElement("small");
        date.className = "edf-blacklist-card-date";
        date.textContent = `Blacklisted ${new Date(entry.addedAt).toLocaleDateString()}`;
        body.append(date);
    }

    const button = document.createElement("button");
    button.type = "button";
    button.className = "edf-blacklist-row-button edf-blacklist-card-button";
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
    body.append(button);

    card.append(body);

    return card;
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
