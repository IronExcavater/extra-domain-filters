import { isBlacklisted, type BlacklistEntry, type ListingSnapshot } from "../../../domain/matching";
import { PageContext } from "../../../shared/platform/router";
import { toggleBundleBlacklist } from "../blacklist/bundle";
import { cloneBlacklistButton, updateButton } from "../blacklist/button";
import {
    CAROUSEL_CHILD_SELECTOR,
    getChildListingUrl,
    getListingSnapshot,
    TOPSPOT_CAROUSEL_SELECTOR,
} from "../dom/card";
import { applyExclusionState, updateExclusionRow } from "../exclusion/row";

function findChildSlides(carouselCard: HTMLElement): HTMLElement[] {
    return [...carouselCard.querySelectorAll<HTMLElement>(CAROUSEL_CHILD_SELECTOR)];
}

function findCarouselListingAnchors(carouselCard: HTMLElement, unique = true): HTMLAnchorElement[] {
    const seen = new Set<string>();

    return [...carouselCard.querySelectorAll<HTMLAnchorElement>('a[href*="domain.com.au"]')]
        .filter(anchor => {
            if (anchor.matches('[data-testid="listing-card-view-more"]')) return false;

            const url = new URL(anchor.href, window.location.origin).href;
            if (unique && seen.has(url)) return false;

            seen.add(url);
            return true;
        });
}

function getAnchorListingElement(anchor: HTMLAnchorElement): HTMLElement {
    return anchor.closest<HTMLElement>(
        `${CAROUSEL_CHILD_SELECTOR}, [data-testid="listing-card-container"], .slick-slide`,
    ) ?? anchor;
}

function findCarouselControls(carouselCard: HTMLElement): { controls: HTMLElement; sourceButton?: HTMLButtonElement } | undefined {
    for (
        let current: HTMLElement | null = carouselCard;
        current && current !== document.body;
        current = current.parentElement
    ) {
        const propertyButton = current.querySelector<HTMLButtonElement>('button[aria-label="Previous property"]');
        if (propertyButton?.parentElement instanceof HTMLElement) {
            return { controls: propertyButton.parentElement, sourceButton: propertyButton };
        }
    }

    const slideButton = carouselCard.querySelector<HTMLButtonElement>('button[aria-label="Previous"]');
    if (slideButton?.parentElement instanceof HTMLElement) {
        return {
            controls: slideButton.parentElement,
            sourceButton: slideButton,
        };
    }

    return undefined;
}

export function getCarouselMembers(carouselCard: HTMLElement): { url: string; snapshot: ListingSnapshot }[] {
    const childMembers = findChildSlides(carouselCard)
        .map(slide => {
            const url = getChildListingUrl(slide);
            return url
                ? { url, snapshot: getListingSnapshot(slide, url) }
                : undefined;
        })
        .filter((entry): entry is { url: string; snapshot: ListingSnapshot } => entry !== undefined);

    return childMembers.length > 0
        ? childMembers
        : findCarouselListingAnchors(carouselCard).map(anchor => {
            const url = new URL(anchor.href, window.location.origin).href;

            return {
                url,
                snapshot: getListingSnapshot(getAnchorListingElement(anchor), url),
            };
        });
}

export function updateCarouselCard(carouselCard: HTMLElement, blacklist: BlacklistEntry[]): void {
    const urls = getCarouselMembers(carouselCard).map(member => member.url);
    const blacklistedUrls = urls.filter(url => isBlacklisted(blacklist, url));
    const button = carouselCard.querySelector<HTMLButtonElement>('.edf-carousel-blacklist-button');

    if (button) {
        button.hidden = urls.length <= 1;
        updateButton(button, blacklistedUrls.length > 0, "Blacklist featured properties");
        applyExclusionState(carouselCard, button, blacklistedUrls.length > 0 ? "blacklisted" : "none");
        if (blacklistedUrls.length > 0) {
            updateExclusionRow(carouselCard, blacklistedUrls, "blacklisted");
        }
    }

    carouselCard.hidden = false;
}

export function bindCarouselCard(carouselCard: HTMLElement, context: PageContext): void {
    if (!carouselCard.matches(TOPSPOT_CAROUSEL_SELECTOR)) return;

    const controls = findCarouselControls(carouselCard);
    const sourceButton = carouselCard.querySelector<HTMLButtonElement>('[data-testid^="listing-card-shortlist"]') ??
        controls?.sourceButton;
    if (!sourceButton) return;

    const existingButton = controls?.controls.querySelector<HTMLButtonElement>('.edf-carousel-blacklist-button') ??
        carouselCard.querySelector('.edf-carousel-blacklist-button');
    if (existingButton) return;

    const button = controls?.sourceButton
        ? controls.sourceButton.cloneNode(true) as HTMLButtonElement
        : cloneBlacklistButton(sourceButton);

    button.type = "button";
    button.disabled = false;
    button.removeAttribute("aria-disabled");
    button.setAttribute("data-testid", "listing-card-blacklist");
    button.dataset.blacklistScope = "carousel";
    button.ariaLabel = "Blacklist featured properties";
    button.title = "Blacklist featured properties";
    if (controls) {
        if (controls.sourceButton) {
            button.dataset.edfInactiveClass = controls.sourceButton.className;
            button.className = `${controls.sourceButton.className} edf-carousel-blacklist-button`;
            updateButton(button, false, "Blacklist featured properties");
        }
        else {
            button.classList.add("edf-carousel-blacklist-button");
        }
        controls.controls.append(button);
    } else {
        button.classList.add("edf-carousel-blacklist-button");
        carouselCard.prepend(button);
    }

    button.addEventListener("click", async event => {
        event.preventDefault();
        event.stopPropagation();

        const members = getCarouselMembers(carouselCard);

        await toggleBundleBlacklist(members);
    });

    void context;
}
