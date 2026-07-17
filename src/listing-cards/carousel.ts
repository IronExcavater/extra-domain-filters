import { createClaimTracker } from "../core/claim";
import { PageContext } from "../core/router";
import { isBlacklisted, type BlacklistEntry } from "../matching";
import { toggleBundleBlacklist } from "./bundle";
import { cloneBlacklistButton, watchShortlistButtonClass } from "./button";
import { getChildListingUrl, getListingSnapshot } from "./card";

const TOPSPOT_CAROUSEL_SELECTOR = 'li[data-testid="topspot"]';
const CHILD_SLIDE_SELECTOR = '[data-testid="listing-card-child-listing"]';

const claimTopspotCard = createClaimTracker<HTMLElement>();

function findChildSlides(carouselCard: HTMLElement): HTMLElement[] {
    return [...carouselCard.querySelectorAll<HTMLElement>(CHILD_SLIDE_SELECTOR)];
}

// See Task 7's live-spike note: shrinking a slide with plain CSS may or may not cause slick to
// reflow the rest of the track. Dispatching a resize event is a low-cost attempt at triggering
// slick's own recompute; if it doesn't reflow in practice, the remaining visual gap is an
// accepted limitation rather than a blocker.
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

    const allExcluded = members.length > 0 &&
        members.every(({ slide, url }) => isSlideExcluded(slide, url, blacklist));
    carouselCard.hidden = allExcluded;
}

export function bindCarouselCard(carouselCard: HTMLElement, context: PageContext): void {
    if (!carouselCard.matches(TOPSPOT_CAROUSEL_SELECTOR)) return;
    if (!claimTopspotCard(carouselCard)) return;

    const sourceButton = carouselCard.querySelector<HTMLButtonElement>('[data-testid^="listing-card-shortlist"]');
    if (!sourceButton) return;

    const button = cloneBlacklistButton(sourceButton);
    button.dataset.blacklistScope = "carousel";
    button.classList.add("edf-carousel-blacklist-button");
    carouselCard.prepend(button);
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
