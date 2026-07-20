import { type BlacklistEntry, type ListingSnapshot } from "../../../domain/matching";
import { PageContext } from "../../../shared/platform/router";
import { getBlacklistedBundleUrls, toggleBundleBlacklist } from "../blacklist/bundle";
import {
    cloneFeaturedActionButton,
    cloneBlacklistButton,
    cloneFeaturedControlButton,
    updateButton,
} from "../clone/blacklistButton";
import {
    CAROUSEL_CHILD_SELECTOR,
    getChildListingUrl,
    getListingSnapshot,
    TOPSPOT_CAROUSEL_SELECTOR,
} from "../dom/card";

const pausedCarousels = new WeakMap<HTMLElement, {
    observer: MutationObserver;
    paused: boolean;
    transform: string;
}>();

function setPauseIcon(button: HTMLButtonElement, paused: boolean): void {
    const icon = button.querySelector<SVGSVGElement>("svg");
    if (!icon || button.dataset.paused === String(paused)) return;

    icon.setAttribute("viewBox", "0 0 24 24");
    icon.replaceChildren();
    const path = document.createElementNS("http://www.w3.org/2000/svg", "path");
    path.setAttribute("fill", "currentColor");
    path.setAttribute("d", paused
        ? "M8 5v14l11-7z"
        : "M7 5h4v14H7zm6 0h4v14h-4z");
    icon.append(path);
    button.dataset.paused = String(paused);
}

function bindCarouselPauseControl(
    carouselCard: HTMLElement,
    controls: HTMLElement,
    sourceButton: HTMLButtonElement,
    memberCount: number,
): void {
    const existing = controls.querySelector<HTMLButtonElement>('[data-testid="listing-card-carousel-pause"]');
    const button = existing ?? cloneFeaturedActionButton(
        sourceButton,
        "listing-card-carousel-pause",
        "Pause featured carousel",
    );
    const track = carouselCard.querySelector<HTMLElement>(".slick-track");

    button.hidden = memberCount <= 1 || !track;
    if (!existing) controls.append(button);
    if (!track || pausedCarousels.has(carouselCard)) return;

    const state = {
        observer: new MutationObserver(() => {
            if (!state.paused) {
                state.transform = track.style.transform;
                return;
            }
            if (track.style.transform !== state.transform) track.style.transform = state.transform;
        }),
        paused: false,
        transform: track.style.transform,
    };
    pausedCarousels.set(carouselCard, state);
    setPauseIcon(button, false);

    button.addEventListener("click", event => {
        event.preventDefault();
        event.stopPropagation();
        state.paused = !state.paused;
        if (!state.paused) state.transform = track.style.transform;
        setPauseIcon(button, state.paused);
        const label = state.paused ? "Play featured carousel" : "Pause featured carousel";
        button.ariaLabel = label;
        button.title = label;
    });
    state.observer.observe(track, { attributes: true, attributeFilter: ["style"] });
}

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
    const members = getCarouselMembers(carouselCard);
    const blacklistedUrls = getBlacklistedBundleUrls(members, blacklist);
    const button = carouselCard.querySelector<HTMLButtonElement>('.edf-featured-blacklist-button');

    if (button) {
        button.hidden = members.length <= 1;
        updateButton(button, blacklistedUrls.length > 0, "Blacklist featured properties");
    }

    for (const child of findChildSlides(carouselCard)) {
        const url = getChildListingUrl(child);
        child.classList.toggle("edf-carousel-child-blacklisted", Boolean(url && blacklistedUrls.includes(url)));
    }

    carouselCard.hidden = false;
}

export function bindCarouselCard(carouselCard: HTMLElement, context: PageContext): void {
    if (!carouselCard.matches(TOPSPOT_CAROUSEL_SELECTOR)) return;

    const controls = findCarouselControls(carouselCard);
    const sourceButton = carouselCard.querySelector<HTMLButtonElement>('[data-testid^="listing-card-shortlist"]') ??
        controls?.sourceButton;
    if (!sourceButton) return;

    const existingButton = controls?.controls.querySelector<HTMLButtonElement>('.edf-featured-blacklist-button') ??
        carouselCard.querySelector('.edf-featured-blacklist-button');
    if (existingButton) {
        if (controls?.sourceButton) {
            bindCarouselPauseControl(
                carouselCard,
                controls.controls,
                controls.sourceButton,
                getCarouselMembers(carouselCard).length,
            );
        }
        return;
    }

    const button = controls?.sourceButton
        ? cloneFeaturedControlButton(controls.sourceButton)
        : cloneBlacklistButton(sourceButton);

    button.type = "button";
    button.disabled = false;
    button.removeAttribute("aria-disabled");
    button.setAttribute("data-testid", "listing-card-blacklist");
    button.dataset.blacklistScope = "carousel";
    button.ariaLabel = "Blacklist featured properties";
    button.title = "Blacklist featured properties";
    if (controls) {
        if (!controls.sourceButton) {
            button.classList.add("edf-featured-blacklist-button");
        }
        controls.controls.append(button);
        bindCarouselPauseControl(
            carouselCard,
            controls.controls,
            controls.sourceButton ?? button,
            getCarouselMembers(carouselCard).length,
        );
    } else {
        button.classList.add("edf-featured-blacklist-button");
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
