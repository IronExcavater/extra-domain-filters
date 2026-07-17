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

function getFeaturedControlsButton(): HTMLButtonElement | undefined {
    return document.querySelector<HTMLButtonElement>(
        'button[aria-label="Previous property"], button[aria-label="Previous"]',
    ) ?? undefined;
}

function findCarouselControls(carouselCard: HTMLElement): { controls: HTMLElement; sourceButton?: HTMLButtonElement } | undefined {
    const featuredButton = getFeaturedControlsButton();
    if (featuredButton?.parentElement instanceof HTMLElement) {
        return { controls: featuredButton.parentElement, sourceButton: featuredButton };
    }

    const scopedControls =
        carouselCard.querySelector<HTMLButtonElement>('button[aria-label="Previous property"]')?.parentElement ??
        carouselCard.querySelector<HTMLButtonElement>('button[aria-label="Previous"]')?.parentElement;
    if (scopedControls instanceof HTMLElement) {
        return {
            controls: scopedControls,
            sourceButton: scopedControls.querySelector<HTMLButtonElement>("button") ?? undefined,
        };
    }

    const section = carouselCard.closest("section, div") ?? document.body;
    const propertyButton = [...section.querySelectorAll<HTMLButtonElement>("button")]
        .find(button => button.ariaLabel === "Previous property" || button.ariaLabel === "Next property");

    return propertyButton?.parentElement instanceof HTMLElement
        ? { controls: propertyButton.parentElement, sourceButton: propertyButton }
        : undefined;
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

    const sourceButton = carouselCard.querySelector<HTMLButtonElement>('[data-testid^="listing-card-shortlist"]');
    if (!sourceButton) return;

    const controls = findCarouselControls(carouselCard);
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
            button.dataset.edfBaseClass = controls.sourceButton.className;
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
        updateButton(button, button.dataset.active !== "true", "Blacklist featured properties");
    });

    void context;
}
