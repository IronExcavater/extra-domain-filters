import { type ExclusionReason, type ListingSnapshot } from "../../../domain/matching";
import { PageContext } from "../../../shared/platform/router";
import { createUiButton } from "../../../shared/ui/elements";
import { setTooltipText } from "../../../shared/ui/tooltip";
import { createBlacklistAction, setBlacklistActionState } from "../actions/blacklistAction";
import { toggleBundleBlacklist } from "../blacklist/bundle";
import {
    CAROUSEL_CHILD_SELECTOR,
    getChildListingUrl,
    getListingSnapshot,
    TOPSPOT_CAROUSEL_SELECTOR,
} from "../dom/card";

export interface CarouselListingDecision {
    exclusionReason: ExclusionReason;
    snapshot: ListingSnapshot;
    url: string;
}

interface PausedCarousel {
    observer: MutationObserver;
    paused: boolean;
    transform: string;
}

const pausedCarousels = new Map<HTMLElement, PausedCarousel>();

export function disposeDetachedCarouselControls(): void {
    for (const [carouselCard, state] of pausedCarousels) {
        if (carouselCard.isConnected) continue;

        state.observer.disconnect();
        pausedCarousels.delete(carouselCard);
    }
}

export function disposeCarouselControls(): void {
    for (const state of pausedCarousels.values()) state.observer.disconnect();
    pausedCarousels.clear();
}

function renderPauseIcon(icon: SVGElement, paused: boolean): void {
    icon.setAttribute("viewBox", "0 0 24 24");
    icon.replaceChildren();
    const path = document.createElementNS("http://www.w3.org/2000/svg", "path");
    path.setAttribute("fill", "currentColor");
    path.setAttribute("d", paused
        ? "M8 5v14l11-7z"
        : "M7 5h4v14H7zm6 0h4v14h-4z");
    icon.append(path);
}

function setPauseIcon(button: HTMLButtonElement, paused: boolean): void {
    const icon = button.querySelector<SVGSVGElement>("svg");
    if (!icon) return;

    renderPauseIcon(icon, paused);
    button.dataset.paused = String(paused);
}

function bindCarouselPauseControl(
    carouselCard: HTMLElement,
    controls: HTMLElement,
    memberCount: number,
    signal: AbortSignal,
): void {
    const existing = controls.querySelector<HTMLButtonElement>('[data-testid="listing-card-carousel-pause"]');
    const button = existing ?? createUiButton({
        ariaLabel: "Pause featured carousel",
        className: "edf-featured-carousel-action",
        icon: icon => renderPauseIcon(icon, false),
        signal,
        tooltip: "Pause featured carousel",
        variant: "icon",
    });
    const track = carouselCard.querySelector<HTMLElement>(".slick-track");

    button.dataset.testid = "listing-card-carousel-pause";
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
        setTooltipText(button, label);
    }, { signal });
    state.observer.observe(track, { attributes: true, attributeFilter: ["style"] });
    signal.addEventListener("abort", () => {
        state.observer.disconnect();
        if (pausedCarousels.get(carouselCard) === state) pausedCarousels.delete(carouselCard);
    }, { once: true });
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

    const members = childMembers.length > 0
        ? childMembers
        : findCarouselListingAnchors(carouselCard).map(anchor => {
            const url = new URL(anchor.href, window.location.origin).href;

            return {
                url,
                snapshot: getListingSnapshot(getAnchorListingElement(anchor), url),
            };
        });
    const seen = new Set<string>();

    return members.filter(({ url }) => {
        const normalized = url.replace(/\/+$/, "");
        if (seen.has(normalized)) return false;
        seen.add(normalized);
        return true;
    });
}

function setCarouselChildDecision(
    child: HTMLElement,
    decision: CarouselListingDecision | undefined,
): void {
    const excluded = decision !== undefined && decision.exclusionReason !== "none";
    const slide = child.closest<HTMLElement>(".slick-slide");

    for (const element of [child, slide]) {
        if (!element) continue;
        element.classList.toggle("edf-carousel-child-blacklisted", excluded);
        if (excluded) element.dataset.exclusionReason = decision.exclusionReason;
        else delete element.dataset.exclusionReason;
    }
}

export function updateCarouselCard(
    carouselCard: HTMLElement,
    decisions: readonly CarouselListingDecision[],
): void {
    const blacklistedUrls = decisions
        .filter(decision => decision.exclusionReason === "blacklisted")
        .map(decision => decision.url);
    const decisionsByUrl = new Map(
        decisions.map(decision => [decision.url.replace(/\/+$/, ""), decision]),
    );
    const button = carouselCard.querySelector<HTMLButtonElement>('.edf-featured-blacklist-button');

    if (button) {
        button.hidden = decisions.length <= 1;
        setBlacklistActionState(button, {
            active: blacklistedUrls.length > 0,
            label: "Blacklist featured properties",
        });
    }

    const currentSlide = carouselCard.querySelector<HTMLElement>(".slick-slide.slick-current");
    let currentExcluded = false;
    for (const child of findChildSlides(carouselCard)) {
        const url = getChildListingUrl(child);
        const slide = child.closest<HTMLElement>(".slick-slide");
        const decision = url ? decisionsByUrl.get(url.replace(/\/+$/, "")) : undefined;

        setCarouselChildDecision(child, decision);
        if (slide === currentSlide && decision && decision.exclusionReason !== "none") {
            currentExcluded = true;
        }
    }

    const allExcluded = decisions.length > 0 &&
        decisions.every(decision => decision.exclusionReason !== "none");
    carouselCard.hidden = allExcluded;

    if (currentExcluded && !allExcluded) {
        carouselCard.querySelector<HTMLButtonElement>(
            'button[aria-label="Next"], button[aria-label="Next property"]',
        )?.click();
    }

    window.dispatchEvent(new Event("resize"));
}

export function bindCarouselCard(
    carouselCard: HTMLElement,
    context: PageContext,
    options: { enableBlacklist: boolean },
): void {
    if (!carouselCard.matches(TOPSPOT_CAROUSEL_SELECTOR)) return;

    const controls = findCarouselControls(carouselCard);
    const sourceButton = carouselCard.querySelector<HTMLButtonElement>('[data-testid^="listing-card-shortlist"]') ??
        controls?.sourceButton;
    if (!sourceButton) return;

    if (!options.enableBlacklist) {
        if (controls?.sourceButton) {
            bindCarouselPauseControl(
                carouselCard,
                controls.controls,
                getCarouselMembers(carouselCard).length,
                context.signal,
            );
        }
        return;
    }

    const existingButton = controls?.controls.querySelector<HTMLButtonElement>('.edf-featured-blacklist-button') ??
        carouselCard.querySelector('.edf-featured-blacklist-button');
    if (existingButton) {
        const memberCount = getCarouselMembers(carouselCard).length;
        existingButton.hidden = memberCount <= 1;
        if (controls?.sourceButton) {
            bindCarouselPauseControl(
                carouselCard,
                controls.controls,
                memberCount,
                context.signal,
            );
        }
        return;
    }

    const button = createBlacklistAction({
        active: false,
        appearance: "carousel",
        label: "Blacklist featured properties",
        onToggle: () => toggleBundleBlacklist(getCarouselMembers(carouselCard)),
        signal: context.signal,
    });
    button.classList.add("edf-featured-blacklist-button");
    if (controls) {
        controls.controls.append(button);
        bindCarouselPauseControl(
            carouselCard,
            controls.controls,
            getCarouselMembers(carouselCard).length,
            context.signal,
        );
    } else {
        carouselCard.prepend(button);
    }
    button.hidden = getCarouselMembers(carouselCard).length <= 1;
}
