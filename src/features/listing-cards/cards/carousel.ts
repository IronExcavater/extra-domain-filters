import { isBlacklisted, type BlacklistEntry } from "../../../domain/matching";
import { PageContext } from "../../../shared/platform/router";
import { replaceWithBinIcon } from "../../../shared/ui/icons";
import { toggleBundleBlacklist } from "../blacklist/bundle";
import { cloneBlacklistButton, updateButton } from "../blacklist/button";
import {
    CAROUSEL_CHILD_SELECTOR,
    getChildListingUrl,
    getListingSnapshot,
    TOPSPOT_CAROUSEL_SELECTOR,
} from "../dom/card";

function findChildSlides(carouselCard: HTMLElement): HTMLElement[] {
    return [...carouselCard.querySelectorAll<HTMLElement>(CAROUSEL_CHILD_SELECTOR)];
}

function findCarouselListingAnchors(carouselCard: HTMLElement, unique = true): HTMLAnchorElement[] {
    const seen = new Set<string>();

    return [...carouselCard.querySelectorAll<HTMLAnchorElement>('a[href*="domain.com.au"]')]
        .filter(anchor => {
            const url = new URL(anchor.href, window.location.origin).href;
            if (unique && seen.has(url)) return false;

            seen.add(url);
            return true;
        });
}

export function getCarouselListingUrls(carouselCard: HTMLElement): string[] {
    return findCarouselListingAnchors(carouselCard)
        .map(anchor => new URL(anchor.href, window.location.origin).href);
}

function getAnchorListingElement(anchor: HTMLAnchorElement): HTMLElement {
    return anchor.closest<HTMLElement>(
        `${CAROUSEL_CHILD_SELECTOR}, [data-testid="listing-card-container"], .slick-slide`,
    ) ?? anchor;
}

function getCarouselSlideElement(anchor: HTMLAnchorElement): HTMLElement {
    return anchor.closest<HTMLElement>(".slick-slide") ?? getAnchorListingElement(anchor);
}

function setSlideExcluded(slide: HTMLElement, excluded: boolean): void {
    const slideShell = slide.closest<HTMLElement>(".slick-slide") ?? slide;

    if (excluded) {
        slideShell.style.setProperty("max-width", "0px", "important");
        slideShell.style.setProperty("min-width", "0px", "important");
        slideShell.style.setProperty("width", "0px", "important");
        slideShell.style.setProperty("overflow", "hidden", "important");
        slideShell.style.setProperty("opacity", "0", "important");
        slide.setAttribute("aria-hidden", "true");
    } else {
        slideShell.style.removeProperty("max-width");
        slideShell.style.removeProperty("min-width");
        slideShell.style.removeProperty("width");
        slideShell.style.removeProperty("overflow");
        slideShell.style.removeProperty("opacity");
        slide.removeAttribute("aria-hidden");
    }

    window.dispatchEvent(new Event("resize"));
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

function isSlideExcluded(slide: HTMLElement, url: string, blacklist: BlacklistEntry[]): boolean {
    return (
        isBlacklisted(blacklist, url) ||
        slide.dataset.exclusionReason === "blacklisted" ||
        slide.dataset.exclusionReason === "filtered"
    );
}

export function updateCarouselCard(carouselCard: HTMLElement, blacklist: BlacklistEntry[]): void {
    const childMembers = findChildSlides(carouselCard)
        .map(slide => ({ slide, url: getChildListingUrl(slide) }))
        .filter((entry): entry is { slide: HTMLElement; url: string } => entry.url !== undefined);
    const members = childMembers.length > 0
        ? childMembers
        : findCarouselListingAnchors(carouselCard, false).map(anchor => ({
            slide: getCarouselSlideElement(anchor),
            url: new URL(anchor.href, window.location.origin).href,
        }));

    for (const { slide, url } of members) {
        setSlideExcluded(slide, isSlideExcluded(slide, url, blacklist));
    }

    carouselCard.hidden = false;
}

export function bindCarouselCard(carouselCard: HTMLElement, context: PageContext): void {
    if (!carouselCard.matches(TOPSPOT_CAROUSEL_SELECTOR)) return;

    const controls = findCarouselControls(carouselCard);
    const sourceButton = carouselCard.querySelector<HTMLButtonElement>('[data-testid^="listing-card-shortlist"]') ??
        controls?.sourceButton;
    if (!sourceButton) return;

    const existingButton = controls?.controls.querySelector('.edf-carousel-blacklist-button') ??
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
            const icon = button.querySelector("svg");
            if (icon) replaceWithBinIcon(icon);
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

        const members = findCarouselListingAnchors(carouselCard)
            .map(anchor => {
                const url = new URL(anchor.href, window.location.origin).href;
                return {
                    url,
                    snapshot: getListingSnapshot(getAnchorListingElement(anchor), url),
                };
            });

        await toggleBundleBlacklist(members);
        updateButton(button, button.dataset.active !== "true", "Blacklist featured properties");
    });

    void context;
}
