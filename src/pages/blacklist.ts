import {
    addBlacklistEntry,
    getBlacklistListing,
    removeBlacklistEntry,
    type BlacklistEntry,
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

    const realList = container
        .querySelector('[data-testid="listing-card-container"]')
        ?.parentElement;

    const list = document.createElement("div");
    list.className = realList instanceof HTMLElement
        ? `${realList.className} edf-blacklist-row-list`
        : "edf-blacklist-row-list edf-blacklist-row-list-fallback";
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

function normalizeStatus(value: string | undefined): string | undefined {
    return value?.trim().toLowerCase();
}

function getStatusClassMap(container: HTMLElement): Map<string, string> {
    const entries = [...container.querySelectorAll<HTMLElement>('[data-testid="listing-card-tag"] span')]
        .map(span => {
            const status = normalizeStatus(span.textContent ?? undefined);
            return status ? [status, span.className] as const : undefined;
        })
        .filter((entry): entry is readonly [string, string] => entry !== undefined);

    return new Map(entries);
}

function getDomainButtonClass(container: HTMLElement): string | undefined {
    return container.querySelector<HTMLButtonElement>(
        '[data-testid="listing-card-buttons-wrapper"] button',
    )?.className;
}

function getInactiveShortlistButtonClass(container: HTMLElement): string | undefined {
    return container.querySelector<HTMLButtonElement>(
        '[data-testid="listing-card-shortlist"]:not([data-testid$="shortlisted"])',
    )?.className;
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

function wireBlacklistToggle(button: HTMLButtonElement, listing: ReturnType<typeof getBlacklistListing>, active: boolean): void {
    button.dataset.active = String(active);
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
}

function updateText(element: Element | null, value: string | undefined): void {
    if (element && value) element.textContent = value;
}

function createShortlistStyledBlacklistRow(
    template: HTMLElement,
    entry: BlacklistEntry,
    active: boolean,
    statusClasses: ReadonlyMap<string, string>,
    inactiveButtonClass: string | undefined,
): HTMLElement {
    const listing = getBlacklistListing(entry);
    const card = template.cloneNode(true) as HTMLElement;
    card.dataset.active = String(active);
    card.dataset.edfBlacklistRow = "true";

    for (const anchor of card.querySelectorAll<HTMLAnchorElement>("a[href]")) {
        anchor.href = listing.url;
    }

    const image = card.querySelector<HTMLImageElement>("img");
    if (image && listing.thumbnailUrl) {
        image.src = listing.thumbnailUrl;
        image.alt = listing.displayAddress ?? listing.title;
    } else if (image) {
        image.remove();
    }

    updateText(card.querySelector('[data-testid="address-wrapper"]'), listing.displayAddress ?? listing.title);
    updateText(card.querySelector('[data-testid="listing-card-price"]'), listing.price);
    const statusTag = card.querySelector<HTMLElement>('[data-testid="listing-card-tag"]');
    updateText(statusTag, listing.status);
    const statusClass = statusClasses.get(normalizeStatus(listing.status) ?? "");
    const statusLabel = statusTag?.querySelector<HTMLElement>("span");
    if (statusClass && statusLabel) statusLabel.className = statusClass;

    const featureValues = [
        listing.features?.bedrooms,
        listing.features?.bathrooms,
        listing.features?.parking,
    ];
    card.querySelectorAll('[data-testid="property-features-text-container"]').forEach((feature, index) => {
        if (featureValues[index]) feature.firstChild!.textContent = featureValues[index];
    });

    const button = card.querySelector<HTMLButtonElement>('[data-testid^="listing-card-shortlist"]') ??
        document.createElement("button");
    button.type = "button";
    if (inactiveButtonClass) button.className = inactiveButtonClass;
    button.setAttribute("data-testid", "extra-domain-filters-blacklist-toggle");
    button.ariaLabel = active ? "Unblacklist" : "Re-blacklist";
    button.title = button.ariaLabel;

    const icon = button.querySelector("svg") ?? document.createElementNS("http://www.w3.org/2000/svg", "svg");
    (active ? replaceWithUnbinIcon : replaceWithBinIcon)(icon);
    if (!icon.parentElement) button.append(icon);

    wireBlacklistToggle(button, listing, active);

    if (!button.parentElement) card.append(button);

    return card;
}

function createBlacklistRow(
    entry: BlacklistEntry,
    active: boolean,
    template: HTMLElement | undefined,
    statusClasses: ReadonlyMap<string, string>,
    inactiveButtonClass: string | undefined,
): HTMLElement {
    const listing = getBlacklistListing(entry);
    if (template) {
        return createShortlistStyledBlacklistRow(template, entry, active, statusClasses, inactiveButtonClass);
    }

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
    button.textContent = active ? "Unblacklist" : "Re-blacklist";
    wireBlacklistToggle(button, listing, active);
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

    const template = container.querySelector<HTMLElement>(
        '[data-testid="listing-card-container"]:not([data-edf-blacklist-row="true"])',
    );
    const statusClasses = getStatusClassMap(container);
    const inactiveButtonClass = getInactiveShortlistButtonClass(container);

    list.replaceChildren(
        ...entries.map(entry => createBlacklistRow(
            entry,
            !entry.removedAt,
            template ?? undefined,
            statusClasses,
            inactiveButtonClass,
        )),
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
