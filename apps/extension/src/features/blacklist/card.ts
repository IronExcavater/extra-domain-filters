import { markOwned } from "../../dom/ownership";
import {
    getBlacklistListing,
    type BlacklistEntry,
} from "../../domain/matching";
import { createSvgIcon } from "../../ui/elements";
import {
    replaceWithBathIcon,
    replaceWithBedIcon,
    replaceWithParkingIcon,
} from "../../ui/icons";
import { createSelectionCheckbox } from "../../ui/selection";
import { createBlacklistAction } from "../listing-cards/actions/blacklistAction";

export interface BlacklistCardOptions {
    active?: boolean;
    onSelectionChange(selected: boolean): void;
    onToggle(button: HTMLButtonElement, nextActive: boolean): Promise<void> | void;
    openLinksInNewTab?: boolean;
    selected: boolean;
    signal?: AbortSignal;
}

function configureLink(
    link: HTMLAnchorElement,
    url: string,
    openInNewTab: boolean,
): void {
    link.href = url;
    if (!openInNewTab) return;

    link.target = "_blank";
    link.rel = "noreferrer";
}

function createFeature(
    value: string | undefined,
    label: string,
    renderIcon: (target: SVGElement) => void,
): HTMLElement | undefined {
    if (!value) return undefined;

    const item = document.createElement("span");

    item.className = "edf-blacklist-card-feature";
    item.ariaLabel = `${value} ${label}`;
    item.append(createSvgIcon(renderIcon), value);

    return item;
}

export function createBlacklistCard(
    entry: BlacklistEntry,
    options: BlacklistCardOptions,
): HTMLElement {
    const listing = getBlacklistListing(entry);
    const active = options.active ?? true;
    const card = document.createElement("article");
    const media = document.createElement("a");
    const body = document.createElement("div");
    const heading = document.createElement("div");
    const price = document.createElement("p");
    const toggle = createBlacklistAction({
        active,
        appearance: "popup",
        onToggle: options.onToggle,
        signal: options.signal,
    });
    const address = document.createElement("a");
    const features = document.createElement("div");

    card.className = "edf-blacklist-card";
    card.dataset.blacklistUrl = listing.url;
    media.className = "edf-blacklist-card-media";
    configureLink(media, listing.url, options.openLinksInNewTab ?? false);
    if (listing.thumbnailUrl) {
        const image = document.createElement("img");
        image.alt = listing.displayAddress ?? listing.title;
        image.loading = "lazy";
        image.src = listing.thumbnailUrl;
        media.append(image);
    } else {
        media.classList.add("edf-blacklist-card-media-empty");
    }

    body.className = "edf-blacklist-card-body";
    heading.className = "edf-blacklist-card-heading";
    price.className = "edf-blacklist-card-price";
    price.textContent = listing.price ?? listing.title;
    toggle.classList.add("edf-blacklist-card-toggle");
    toggle.dataset.testid = "extra-domain-filters-blacklist-toggle";
    heading.append(
        createSelectionCheckbox(
            options.selected,
            `Select ${listing.displayAddress ?? listing.title}`,
            options.onSelectionChange,
        ),
        price,
        toggle,
    );

    address.className = "edf-blacklist-card-address";
    address.textContent = listing.displayAddress ?? listing.title;
    configureLink(address, listing.url, options.openLinksInNewTab ?? false);
    features.className = "edf-blacklist-card-features";
    features.append(...[
        createFeature(listing.features?.bedrooms, "bedrooms", replaceWithBedIcon),
        createFeature(listing.features?.bathrooms, "bathrooms", replaceWithBathIcon),
        createFeature(listing.features?.parking, "parking spaces", replaceWithParkingIcon),
    ].filter((feature): feature is HTMLElement => feature !== undefined));

    body.append(heading, address);
    if (features.childElementCount > 0) body.append(features);
    card.append(media, body);

    return markOwned(card, "blacklist-card");
}
