import { replaceWithBinIcon, replaceWithShortlistIcon } from "../core/icons";
import { PageMount } from "../core/router";
import { getFromStorage, onStorageChange, setInStorage } from "../core/storage";
import {
    getBlacklistListing,
    removeBlacklistEntry,
    type ListingSnapshot,
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

function findListContainer(container: HTMLElement): HTMLElement {
    const existing = container.querySelector<HTMLElement>(
        '[data-testid="extra-domain-filters-blacklist-list"]',
    );
    if (existing) return existing;

    const listingCard = container.querySelector<HTMLElement>(
        '[data-testid="listing-card-container"]',
    );

    if (listingCard?.parentElement instanceof HTMLElement) {
        listingCard.parentElement.setAttribute(
            "data-testid",
            "extra-domain-filters-blacklist-list",
        );
        return listingCard.parentElement;
    }

    const list = document.createElement("div");
    list.className = "edf-blacklist-card-list";
    list.setAttribute("data-testid", "extra-domain-filters-blacklist-list");

    const message = container.querySelector('[data-testid="shortlist__message_wrapper"]');
    if (message) {
        message.after(list);
    } else {
        container.append(list);
    }

    return list;
}

function updateTitle(container: HTMLElement): void {
    const title = container.querySelector<HTMLElement>(
        '[data-testid="shortlist__title"], h1, h2',
    );

    if (title) {
        title.textContent = "Your blacklist";
    }
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

function textFromPattern(text: string, pattern: RegExp): string | undefined {
    return text.match(pattern)?.[1];
}

function getPrice(listing: ListingSnapshot): string {
    return listing.price ??
        textFromPattern(listing.text, /(\$\s?[\d,.]+(?:\s*(?:per week|pw|p\/w))?)/i) ??
        "";
}

function getFeatures(listing: ListingSnapshot): NonNullable<ListingSnapshot["features"]> {
    return {
        bathrooms: listing.features?.bathrooms ??
            textFromPattern(listing.text, /(\d+)\s*Bath/i),
        bedrooms: listing.features?.bedrooms ??
            textFromPattern(listing.text, /(\d+)\s*Beds?/i),
        parking: listing.features?.parking ??
            textFromPattern(listing.text, /(\d+)\s*Parking/i),
    };
}

function appendFeature(
    container: HTMLElement,
    value: string | undefined,
    label: string,
): void {
    if (!value) return;

    const feature = document.createElement("span");
    feature.setAttribute("data-testid", "property-features-feature");
    feature.textContent = `${value} ${label}`;
    container.append(feature);
}

function createBlacklistCard(entry: BlacklistEntry): HTMLElement {
    const listing = getBlacklistListing(entry);
    const features = getFeatures(listing);
    const card = document.createElement("div");
    const wrapper = document.createElement("div");
    const media = document.createElement("a");
    const body = document.createElement("div");
    const priceWrapper = document.createElement("div");
    const price = document.createElement("p");
    const buttonContainer = document.createElement("span");
    const shortlistButton = document.createElement("button");
    const shortlistIcon = document.createElementNS("http://www.w3.org/2000/svg", "svg");
    const removeButton = document.createElement("button");
    const icon = document.createElementNS("http://www.w3.org/2000/svg", "svg");
    const address = document.createElement("a");
    const addressTitle = document.createElement("h2");
    const featureWrapper = document.createElement("div");
    const footer = document.createElement("div");
    const openButton = document.createElement("a");

    card.className = "edf-blacklist-card";
    card.dataset.listingId = listing.url.match(/-(\d+)(?:\?.*)?$/)?.[1] ?? "";
    card.setAttribute("data-testid", "listing-card-container");

    wrapper.className = "edf-blacklist-card-wrapper";
    wrapper.setAttribute("data-testid", "listing-card-wrapper-tall");

    media.className = "edf-blacklist-card-media";
    media.href = listing.url;

    if (listing.thumbnailUrl) {
        const image = document.createElement("img");
        image.src = listing.thumbnailUrl;
        image.alt = `Picture of ${listing.displayAddress ?? listing.title}`;
        image.loading = "lazy";
        media.append(image);
    }

    body.className = "edf-blacklist-card-body";

    priceWrapper.className = "edf-blacklist-card-price";
    priceWrapper.setAttribute("data-testid", "listing-card-price-wrapper");

    price.setAttribute("data-testid", "listing-card-price");
    price.textContent = getPrice(listing);

    buttonContainer.className = "edf-listing-card-buttons";
    buttonContainer.setAttribute("data-testid", "listing-card-blacklist-buttons");

    shortlistIcon.setAttribute("aria-hidden", "true");
    replaceWithShortlistIcon(shortlistIcon);

    shortlistButton.type = "button";
    shortlistButton.disabled = true;
    shortlistButton.setAttribute("data-testid", "listing-card-shortlist-shortlisted");
    shortlistButton.ariaLabel = "Already removed from shortlist";
    shortlistButton.title = "Already removed from shortlist";
    shortlistButton.append(shortlistIcon);

    icon.setAttribute("aria-hidden", "true");
    replaceWithBinIcon(icon);

    removeButton.type = "button";
    removeButton.setAttribute("data-testid", "listing-card-blacklist");
    removeButton.ariaLabel = "Remove from blacklist";
    removeButton.title = "Remove from blacklist";
    removeButton.append(icon);
    removeButton.addEventListener("click", async () => {
        const current = (await getFromStorage<BlacklistEntry[]>("blacklist")) ?? [];
        await setInStorage(
            "blacklist",
            removeBlacklistEntry(current, listing.url),
        );
    });

    buttonContainer.append(shortlistButton, removeButton);
    priceWrapper.append(price, buttonContainer);

    address.className = "address is-two-lines";
    address.href = listing.url;
    address.rel = "noopener";

    if (entry.addedAt > 0) {
        const date = document.createElement("small");
        date.className = "edf-blacklist-card-date";
        date.textContent = `Added ${new Date(entry.addedAt).toLocaleDateString()}`;
        addressTitle.append(date);
    }

    addressTitle.setAttribute("data-testid", "address-wrapper");
    addressTitle.prepend(listing.displayAddress ?? listing.title);
    address.append(addressTitle);

    featureWrapper.className = "edf-blacklist-card-features";
    featureWrapper.setAttribute("data-testid", "listing-card-features-wrapper");
    appendFeature(featureWrapper, features.bedrooms, "Beds");
    appendFeature(featureWrapper, features.bathrooms, "Bath");
    appendFeature(featureWrapper, features.parking, "Parking");

    footer.className = "edf-blacklist-card-footer";
    footer.setAttribute("data-testid", "listing-card-buttons-wrapper");

    openButton.href = listing.url;
    openButton.textContent = "View property";
    footer.append(openButton);

    body.append(priceWrapper, address, featureWrapper, footer);
    wrapper.append(media, body);
    card.append(wrapper);

    return card;
}

async function render(container: HTMLElement, list: HTMLElement): Promise<void> {
    const blacklist = (await getFromStorage<BlacklistEntry[]>("blacklist")) ?? [];
    const controls = getControls(container, list);
    const message = container.querySelector<HTMLElement>(
        '[data-testid="shortlist__message_wrapper"]',
    );

    const clearButton = document.createElement("button");
    clearButton.type = "button";
    clearButton.textContent = "Clear all";
    clearButton.disabled = blacklist.length === 0;
    clearButton.className = [
        container
        .querySelector<HTMLElement>('[data-testid="listing-tabs__filters-sort-by"] button')
        ?.className,
        "edf-blacklist-clear-button",
    ].filter(Boolean).join(" ");
    clearButton.addEventListener("click", () => void setInStorage("blacklist", []));

    controls.replaceChildren(clearButton);

    if (message) {
        message.hidden = blacklist.length > 0;
        if (blacklist.length === 0) {
            message.textContent = "No blacklisted properties yet.";
        }
    }

    list.classList.add("edf-blacklist-card-list");
    list.replaceChildren(...blacklist.map(createBlacklistCard));
}

const mountBlacklistPage: PageMount = async (context) => {
    const container = await waitForShortlistContainer(context.signal);
    updateTitle(container);

    const list = findListContainer(container);
    await render(container, list);

    const unwatch = onStorageChange<BlacklistEntry[]>(
        "blacklist",
        () => void render(container, list),
    );
    context.signal.addEventListener("abort", unwatch, { once: true });
};

export default mountBlacklistPage;
