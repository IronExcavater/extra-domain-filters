import type { ListingSnapshot } from "../../../domain/matching";

export const SHORTLIST_BUTTON_SELECTOR = '[data-testid^="listing-card-shortlist"]';
export const BLACKLIST_BUTTON_SELECTOR = '[data-testid="listing-card-blacklist"]';
export const PROJECT_CARD_SELECTOR = 'li[data-testid^="listing-"]';
export const PROJECT_MARKER_SELECTOR = '[data-testid="listing-card-project"]';
export const PROJECT_DETAILS_SELECTOR = '[data-testid="listing-card-project-details"]';
export const TOPSPOT_CAROUSEL_SELECTOR =
    'li[data-testid="topspot"], li:has([data-testid="listing-card-child-listing"]):not(:has([data-testid="listing-card-project"]))';
export const CAROUSEL_CHILD_SELECTOR = '[data-testid="listing-card-child-listing"]';
export const LISTING_CARD_CONTAINER_SELECTOR = '[data-testid="listing-card-container"]';
const AGENCY_CARD_SELECTOR = '[data-testid="listings-tabs__card"]';

const CARD_SELECTOR = [
    LISTING_CARD_CONTAINER_SELECTOR,
    AGENCY_CARD_SELECTOR,
    CAROUSEL_CHILD_SELECTOR,
    TOPSPOT_CAROUSEL_SELECTOR,
    '[data-testid="listing-card-wrapper-project-child"]',
    '[data-testid="listing-card-wrapper-standard"]',
    '[data-testid="similar-listing"]',
    '[data-testid="listing-details__other-listings-listing"]',
    'li[data-testid^="listing-"]',
].join(',');

export const TOP_LEVEL_CARD_SELECTOR = [
    LISTING_CARD_CONTAINER_SELECTOR,
    AGENCY_CARD_SELECTOR,
    TOPSPOT_CAROUSEL_SELECTOR,
    'li[data-testid^="listing-"]',
].join(',');

export type BlacklistCardKind =
    | "standard"
    | "carousel"
    | "carousel-child"
    | "project"
    | "project-child";

function scoreListingAnchor(anchor: HTMLAnchorElement): number {
    const url = new URL(anchor.href, window.location.origin);
    const testId = anchor.dataset.testid?.toLowerCase() ?? "";
    let score = 0;

    if (/^\/project\/\d+(?:\/|$)/.test(url.pathname)) score += 1_000;
    if (/[-/]\d{6,}\/?$/.test(url.pathname)) score += 600;
    if (testId.includes("address") || testId.includes("listing-card-link")) score += 500;
    if (anchor.querySelector('[data-testid*="address" i], [data-testid="address-wrapper"]')) {
        score += 450;
    }
    if (anchor.querySelector("h1, h2, h3")) score += 350;
    if (anchor.querySelector(LISTING_PHOTO_SELECTOR)) score += 250;
    if (/\/(?:agents?|real-estate-agenc(?:y|ies)|news|profile)(?:\/|$)/i.test(url.pathname)) {
        score -= 2_000;
    }
    return score;
}

/** Resolve the property/project link without assuming it is the first anchor.
 * Featured cards commonly place an agency logo and agent profile before the
 * address, so DOM order alone can point blacklist actions at the wrong URL. */
export function findListingAnchor(root: ParentNode): HTMLAnchorElement | undefined {
    const anchors = [...root.querySelectorAll<HTMLAnchorElement>('a[href]')];
    const ranked = anchors
        .map((anchor, index) => ({ anchor, index, score: scoreListingAnchor(anchor) }))
        .sort((first, second) => second.score - first.score || first.index - second.index);

    return ranked.find(candidate => candidate.score > 0)?.anchor ?? anchors[0];
}

export function getCard(button: Element): Element | undefined {
    if ((button as HTMLElement).dataset.blacklistScope === "project") {
        return button.closest(PROJECT_CARD_SELECTOR) ?? undefined;
    }
    if ((button as HTMLElement).dataset.blacklistScope === "carousel-child") {
        return button.closest(".slick-slide") ?? button.closest(CAROUSEL_CHILD_SELECTOR) ?? undefined;
    }

    return button.closest(CARD_SELECTOR) ?? undefined;
}

export function getBlacklistCardKind(card: Element, button?: Element): BlacklistCardKind {
    if ((button as HTMLElement | undefined)?.dataset.blacklistScope === "project") {
        return "project";
    }
    if ((button as HTMLElement | undefined)?.dataset.blacklistScope === "carousel") {
        return "carousel";
    }
    if ((button as HTMLElement | undefined)?.dataset.blacklistScope === "carousel-child") {
        return "carousel-child";
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
            : (button as HTMLElement).dataset.blacklistScope === "carousel-child"
                ? findListingAnchor(card)
            : button.closest<HTMLAnchorElement>("a[href]") ??
                findListingAnchor(card);

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

function getPropertyType(card: Element): string | undefined {
    return [...card.querySelectorAll('[data-testid="property-features-feature"]')]
        .map(feature => feature.textContent?.trim().replace(/\s+/g, " "))
        .find((text): text is string =>
            text !== undefined &&
            /^[a-z][a-z\s&/-]+$/i.test(text) &&
            !/^(beds?|bath|parking|car|garage)\b/i.test(text),
        );
}

export function getListingImageUrls(card: Element): string[] {
    const urls = new Set<string>();

    for (const image of card.querySelectorAll<HTMLImageElement>(LISTING_PHOTO_SELECTOR)) {
        const url = image.currentSrc || image.src;
        if (url) urls.add(url);
    }

    return [...urls];
}

interface ListingSnapshotOptions {
    includeThumbnail?: boolean;
}

/** Card text without anything the extension injected (pills, hidden rows, tooltips). */
function getOwnText(card: Element): string {
    if (!card.querySelector("[data-extra-domain-filters-owner], [class*='edf-']")) return card.textContent ?? "";
    const clone = card.cloneNode(true) as Element;
    clone.querySelectorAll("[data-extra-domain-filters-owner], [class*='edf-']").forEach(node => node.remove());
    return clone.textContent ?? "";
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
        text: getOwnText(card),
        displayAddress: title,
        features: {
            bathrooms: getFeature(card, /^(\d+)\s*Bath/i),
            bedrooms: getFeature(card, /^(\d+)\s*Beds?/i),
            parking: getFeature(card, /^(\d+)\s*Parking/i),
        },
        price: card.querySelector('[data-testid="listing-card-price"]')
            ?.textContent?.trim(),
        propertyType: getPropertyType(card),
        thumbnailUrl: includeThumbnail ? getThumbnailUrl(card) : undefined,
        imageUrls: includeThumbnail ? getListingImageUrls(card) : undefined,
    };
}

export function getPropertyCount(card: Element): number {
    const children = card.querySelectorAll('[data-testid="listing-card-child-listing"]').length;
    return Math.max(children, 1);
}

export function getChildListingUrl(child: Element): string | undefined {
    const anchor = findListingAnchor(child);
    if (!anchor) return undefined;

    return new URL(anchor.href, window.location.origin).href;
}
