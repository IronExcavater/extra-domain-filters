import type { ListingSnapshot } from "../../../domain/matching";

export interface ShortlistSnapshotActions {
    blacklistButton: HTMLButtonElement;
}

function setText(element: Element | null, text: string | undefined): void {
    if (element && text) element.textContent = text;
}

function createImage(listing: ListingSnapshot): HTMLElement {
    const imageLink = document.createElement("a");
    const imageWrapper = document.createElement("div");

    imageLink.href = listing.url;
    imageLink.className = "css-1abqvvq";
    imageWrapper.className = "css-6yavch";
    imageWrapper.setAttribute("data-testid", "listing-card-lazy-image");

    if (listing.thumbnailUrl) {
        const image = document.createElement("img");
        image.src = listing.thumbnailUrl;
        image.alt = listing.displayAddress ?? listing.title;
        image.loading = "lazy";
        imageWrapper.append(image);
    }

    imageLink.append(imageWrapper);
    return imageLink;
}

function createFeature(value: string | undefined, label: string): HTMLElement {
    const feature = document.createElement("span");

    feature.setAttribute("data-testid", "property-features-feature");
    feature.className = "css-1ef2wj3";
    feature.textContent = value ? `${value} ${label}` : "";

    return feature;
}

export function createShortlistSnapshotCard(
    listing: ListingSnapshot,
    actions: ShortlistSnapshotActions,
    template?: HTMLElement,
): HTMLElement {
    if (template) return createTemplatedShortlistSnapshotCard(listing, actions, template);

    const card = document.createElement("div");
    const wrapper = document.createElement("div");
    const media = document.createElement("div");
    const content = document.createElement("div");
    const priceRow = document.createElement("div");
    const price = document.createElement("p");
    const address = document.createElement("a");
    const features = document.createElement("div");

    card.className = "css-eztut6";
    card.setAttribute("data-testid", "listing-card-container");

    wrapper.className = "css-1iszjo9";
    wrapper.setAttribute("data-testid", "listing-card-wrapper-tall");

    media.className = "css-1t7a3eq";
    media.append(createImage(listing));

    content.className = "css-paalrb";

    priceRow.className = "edf-listing-card-button-container";
    price.setAttribute("data-testid", "listing-card-price");
    price.className = "css-1lo1e4i";
    setText(price, listing.price);
    priceRow.append(price, actions.blacklistButton);

    address.href = listing.url;
    address.setAttribute("data-testid", "address-wrapper");
    address.className = "css-mgq8yx";
    address.textContent = listing.displayAddress ?? listing.title;

    features.setAttribute("data-testid", "property-features");
    features.className = "css-ia2to9";
    features.append(
        createFeature(listing.features?.bedrooms, "Beds"),
        createFeature(listing.features?.bathrooms, "Baths"),
        createFeature(listing.features?.parking, "Parking"),
    );

    content.append(priceRow, address, features);
    wrapper.append(media, content);
    card.append(wrapper);

    return card;
}

function createTemplatedShortlistSnapshotCard(
    listing: ListingSnapshot,
    actions: ShortlistSnapshotActions,
    template: HTMLElement,
): HTMLElement {
    const card = template.cloneNode(true) as HTMLElement;
    const media = card.querySelector<HTMLElement>('[data-testid="listing-card-carousel"]')?.closest<HTMLElement>(".css-1t7a3eq");
    const price = card.querySelector<HTMLElement>('[data-testid="listing-card-price"]');
    const priceRow = price?.parentElement;
    const address = card.querySelector<HTMLElement>('[data-testid="address-wrapper"]');
    const addressLink = address?.closest<HTMLAnchorElement>("a");

    card.removeAttribute("data-listing-id");
    card.querySelector('[data-testid="listing-card-tag"]')?.remove();
    card.querySelector('[data-testid="listing-card-buttons-wrapper"]')?.remove();
    card.querySelector("textarea")?.closest('[role="button"]')?.remove();

    if (media) media.replaceChildren(createImage(listing));
    setText(price, listing.price);
    if (priceRow) {
        priceRow.querySelectorAll('[data-testid^="listing-card-shortlist"], .edf-blacklist-button')
            .forEach(button => button.remove());
        priceRow.append(actions.blacklistButton);
    }

    if (address) address.textContent = listing.displayAddress ?? listing.title;
    if (addressLink) addressLink.href = listing.url;

    return card;
}
