import { isBlacklisted, type BlacklistEntry } from "../../../domain/matching";
import { createClaimTracker } from "../../../shared/dom/claim";
import { PageContext } from "../../../shared/platform/router";
import { toggleBundleBlacklist } from "../blacklist/bundle";
import { cloneBlacklistButton, watchShortlistButtonClass } from "../blacklist/button";
import {
    CAROUSEL_CHILD_SELECTOR,
    getChildListingUrl,
    getListingSnapshot,
    TOPSPOT_CAROUSEL_SELECTOR,
} from "../dom/card";

const claimTopspotCard = createClaimTracker<HTMLElement>();

function findChildSlides(carouselCard: HTMLElement): HTMLElement[] {
    return [...carouselCard.querySelectorAll<HTMLElement>(CAROUSEL_CHILD_SELECTOR)];
}

function setSlideExcluded(slide: HTMLElement, excluded: boolean): void {
    if (excluded) {
        slide.style.setProperty("max-width", "0px", "important");
        slide.style.setProperty("min-width", "0px", "important");
        slide.style.setProperty("overflow", "hidden", "important");
        slide.style.setProperty("opacity", "0", "important");
    } else {
        slide.style.removeProperty("max-width");
        slide.style.removeProperty("min-width");
        slide.style.removeProperty("overflow");
        slide.style.removeProperty("opacity");
    }

    window.dispatchEvent(new Event("resize"));
}

function findCarouselControls(carouselCard: HTMLElement): HTMLElement | undefined {
    const scopedControls =
        carouselCard.querySelector<HTMLButtonElement>('button[aria-label="Previous property"]')?.parentElement ??
        carouselCard.querySelector<HTMLButtonElement>('button[aria-label="Previous"]')?.parentElement;
    if (scopedControls instanceof HTMLElement) return scopedControls;

    const section = carouselCard.closest("section, div") ?? document.body;
    const propertyControls = [...section.querySelectorAll<HTMLButtonElement>("button")]
        .find(button => button.ariaLabel === "Previous property" || button.ariaLabel === "Next property")
        ?.parentElement;

    return propertyControls instanceof HTMLElement ? propertyControls : undefined;
}

function isSlideExcluded(slide: HTMLElement, url: string, blacklist: BlacklistEntry[]): boolean {
    return (
        isBlacklisted(blacklist, url) ||
        slide.dataset.exclusionReason === "blacklisted" ||
        slide.dataset.exclusionReason === "filtered"
    );
}

export function updateCarouselCard(carouselCard: HTMLElement, blacklist: BlacklistEntry[]): void {
    const members = findChildSlides(carouselCard)
        .map(slide => ({ slide, url: getChildListingUrl(slide) }))
        .filter((entry): entry is { slide: HTMLElement; url: string } => entry.url !== undefined);

    for (const { slide, url } of members) {
        setSlideExcluded(slide, isSlideExcluded(slide, url, blacklist));
    }

    carouselCard.hidden = false;
}

export function bindCarouselCard(carouselCard: HTMLElement, context: PageContext): void {
    if (!carouselCard.matches(TOPSPOT_CAROUSEL_SELECTOR)) return;
    if (!claimTopspotCard(carouselCard)) return;

    const sourceButton = carouselCard.querySelector<HTMLButtonElement>('[data-testid^="listing-card-shortlist"]');
    if (!sourceButton) return;

    const button = cloneBlacklistButton(sourceButton);
    button.dataset.blacklistScope = "carousel";
    button.classList.add("edf-carousel-blacklist-button");
    button.ariaLabel = "Blacklist featured properties";
    button.title = "Blacklist featured properties";
    const controls = findCarouselControls(carouselCard);
    if (controls) controls.append(button);
    else carouselCard.prepend(button);
    watchShortlistButtonClass(sourceButton, button, context);

    button.addEventListener("click", async event => {
        event.preventDefault();
        event.stopPropagation();

        const members = findChildSlides(carouselCard)
            .map(slide => {
                const url = getChildListingUrl(slide);
                if (!url) return undefined;
                return { url, snapshot: getListingSnapshot(slide, url) };
            })
            .filter((member): member is { url: string; snapshot: ReturnType<typeof getListingSnapshot> } =>
                member !== undefined,
            );

        await toggleBundleBlacklist(members);
    });

    void context;
}
