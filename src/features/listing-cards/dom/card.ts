import type { ListingSnapshot } from "../../../domain/matching";

export const SHORTLIST_BUTTON_SELECTOR = '[data-testid^="listing-card-shortlist"]';
export const BLACKLIST_BUTTON_SELECTOR = '[data-testid="listing-card-blacklist"]';
export const PROJECT_CARD_SELECTOR = 'li[data-testid^="listing-"]';
export const PROJECT_MARKER_SELECTOR = '[data-testid="listing-card-project"]';
export const PROJECT_DETAILS_SELECTOR = '[data-testid="listing-card-project-details"]';
export const TOPSPOT_CAROUSEL_SELECTOR = 'li[data-testid="topspot"]';
export const CAROUSEL_CHILD_SELECTOR = '[data-testid="listing-card-child-listing"]';
const LISTING_CARD_CONTAINER_SELECTOR = '[data-testid="listing-card-container"]';

const CARD_SELECTOR = [
    LISTING_CARD_CONTAINER_SELECTOR,
    CAROUSEL_CHILD_SELECTOR,
    TOPSPOT_CAROUSEL_SELECTOR,
    'li[data-testid^="listing-"]',
].join(',');

export const TOP_LEVEL_CARD_SELECTOR = [
    LISTING_CARD_CONTAINER_SELECTOR,
    TOPSPOT_CAROUSEL_SELECTOR,
    'li[data-testid^="listing-"]',
].join(',');

export type BlacklistCardKind =
    | "standard"
    | "carousel-child"
    | "project"
    | "project-child";

export function getCard(button: Element): Element | undefined {
    if ((button as HTMLElement).dataset.blacklistScope === "project") {
        return button.closest(PROJECT_CARD_SELECTOR) ?? undefined;
    }

    return button.closest(CARD_SELECTOR) ?? undefined;
}

export function getBlacklistCardKind(card: Element, button?: Element): BlacklistCardKind {
    if ((button as HTMLElement | undefined)?.dataset.blacklistScope === "project") {
        return "project";
    }

    if (card.matches('[data-testid="listing-card-child-listing"]')) {
        const projectCard = card.closest(PROJECT_CARD_SELECTOR);
        return projectCard?.querySelector(PROJECT_MARKER_SELECTOR)
            ? "project-child"
            : "carousel-child";
    }

    return "standard";
}

export function getListingUrl(button: Element, card: Element): string | undefined {
    const anchor =
        (button as HTMLElement).dataset.blacklistScope === "project"
            ? card.querySelector<HTMLAnchorElement>('a[href*="/project/"]')
            : button.closest<HTMLAnchorElement>("a[href]") ??
                card.querySelector<HTMLAnchorElement>('a[href*="domain.com.au"]');

    if (!anchor) return undefined;

    return new URL(anchor.href, window.location.origin).href;
}

export function getTitle(card: Element): string {
    return (
        card.querySelector('[data-testid="address-wrapper"], [data-testid*="address"], h2, h3')
            ?.textContent?.trim() ??
        card.querySelector<HTMLImageElement>("img")?.alt?.replace(/^Picture of\s+/i, "").trim() ??
        card.querySelector('[data-testid="listing-card-price"]')?.textContent?.trim() ??
        "Domain listing"
    );
}

const BRANDING_IMAGE_SELECTOR = '[data-testid="listing-card-branding"] img';
const LISTING_PHOTO_SELECTOR =
    '[data-testid="listing-card-lazy-image"] img, [data-testid="listing-card-single-image"] img';

export function getThumbnailUrl(card: Element): string | undefined {
    const listingPhoto = card.querySelector<HTMLImageElement>(LISTING_PHOTO_SELECTOR);
    if (listingPhoto) return listingPhoto.currentSrc || listingPhoto.src;

    const brandingImages = new Set(card.querySelectorAll<HTMLImageElement>(BRANDING_IMAGE_SELECTOR));
    const images = [...card.querySelectorAll<HTMLImageElement>("img")]
        .filter(image => !brandingImages.has(image));

    return images
        .map(image => {
            const src = image.currentSrc || image.src;
            const rect = image.getBoundingClientRect();
            const renderedArea = rect.width * rect.height;
            const naturalArea = image.naturalWidth * image.naturalHeight;
            const text = `${src} ${image.alt}`.toLowerCase();
            const isLogo = /\/logo_|\/agencys\/|agency|logo/.test(text);
            const isListingPhoto = /^picture of\s+/i.test(image.alt) && !isLogo;

            return {
                src,
                score:
                    (isListingPhoto ? 10_000 : 0) +
                    (isLogo ? -10_000 : 0) +
                    Math.max(renderedArea, naturalArea),
            };
        })
        .sort((first, second) => second.score - first.score)
        .find(candidate => candidate.src)
        ?.src;
}

function getFeature(card: Element, pattern: RegExp): string | undefined {
    for (const feature of card.querySelectorAll('[data-testid="property-features-feature"]')) {
        const text = feature.textContent?.trim().replace(/\s+/g, " ");
        const match = text?.match(pattern);

        if (match) return match[1];
    }

    return undefined;
}

interface ListingSnapshotOptions {
    includeThumbnail?: boolean;
}

export function getListingSnapshot(
    card: Element,
    url: string,
    options: ListingSnapshotOptions = {},
): ListingSnapshot {
    const title = getTitle(card);
    const includeThumbnail = options.includeThumbnail ?? true;

    return {
        url,
        title,
        text: card.textContent ?? "",
        displayAddress: title,
        features: {
            bathrooms: getFeature(card, /^(\d+)\s*Bath/i),
            bedrooms: getFeature(card, /^(\d+)\s*Beds?/i),
            parking: getFeature(card, /^(\d+)\s*Parking/i),
        },
        price: card.querySelector('[data-testid="listing-card-price"]')
            ?.textContent?.trim(),
        status: card.querySelector('[data-testid="listing-card-tag"]')
            ?.textContent?.trim(),
        thumbnailUrl: includeThumbnail ? getThumbnailUrl(card) : undefined,
    };
}

export function getPropertyCount(card: Element): number {
    const children = card.querySelectorAll('[data-testid="listing-card-child-listing"]').length;
    return Math.max(children, 1);
}

export function getChildListingUrl(child: Element): string | undefined {
    const anchor = child.querySelector<HTMLAnchorElement>('a[href*="domain.com.au"]');
    if (!anchor) return undefined;

    return new URL(anchor.href, window.location.origin).href;
}
