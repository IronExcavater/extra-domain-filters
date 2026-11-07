import { type ExclusionReason, type ListingSnapshot } from "../../../domain/matching";
import { PageContext } from "../../../platform/router";
import { createSvgIcon } from "../../../ui/elements";
import { attachTooltip, setTooltipText } from "../../../ui/tooltip";
import { createBlacklistAction, setBlacklistActionState } from "../actions/blacklistAction";
import { toggleBundleBlacklist } from "../blacklist/bundle";
import { toggleBlacklist } from "../blacklist/toggle";
import {
    CAROUSEL_CHILD_SELECTOR,
    findListingAnchor,
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

interface CarouselActionHostState {
    host: HTMLElement;
    observer: MutationObserver;
    stop(): void;
}

interface CarouselHydrationState {
    frame: number | undefined;
    memberCount: number;
    observer: MutationObserver;
    options: { enableBlacklist: boolean; enablePause: boolean };
}

// This targets the Slick carousel library's own DOM structure (.slick-track, .slick-slide,
// .slick-current) and English-language aria-label text ("Previous"/"Next" property), since
// Domain doesn't expose a stable data-testid for carousel navigation. If Domain swaps carousel
// libraries, changes button copy, or serves a non-English locale, this feature silently stops
// working rather than erroring — there's no reliable way to detect that from here.
const pausedCarousels = new Map<HTMLElement, PausedCarousel>();
const carouselActionHosts = new Map<HTMLElement, CarouselActionHostState>();
const carouselHydrationObservers = new Map<HTMLElement, CarouselHydrationState>();

function removeCarouselActionHost(carouselCard: HTMLElement): void {
    const state = carouselActionHosts.get(carouselCard);
    if (!state) return;

    state.stop();
    state.host.remove();
    carouselActionHosts.delete(carouselCard);
}

function removeCarouselHydrationObserver(carouselCard: HTMLElement): void {
    const state = carouselHydrationObservers.get(carouselCard);
    if (!state) return;

    state.observer.disconnect();
    if (state.frame !== undefined) cancelAnimationFrame(state.frame);
    carouselHydrationObservers.delete(carouselCard);
}

export function disposeDetachedCarouselControls(): void {
    for (const [carouselCard, state] of pausedCarousels) {
        if (carouselCard.isConnected) continue;

        state.observer.disconnect();
        pausedCarousels.delete(carouselCard);
    }

    for (const carouselCard of carouselActionHosts.keys()) {
        if (carouselCard.isConnected) continue;
        removeCarouselActionHost(carouselCard);
    }
    for (const carouselCard of carouselHydrationObservers.keys()) {
        if (carouselCard.isConnected) continue;
        removeCarouselHydrationObserver(carouselCard);
    }
}

export function disposeCarouselControls(): void {
    for (const state of pausedCarousels.values()) state.observer.disconnect();
    pausedCarousels.clear();
    for (const carouselCard of carouselActionHosts.keys()) removeCarouselActionHost(carouselCard);
    for (const carouselCard of carouselHydrationObservers.keys()) {
        removeCarouselHydrationObserver(carouselCard);
    }
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

function createPauseButton(signal: AbortSignal): HTMLButtonElement {
    const button = document.createElement("button");
    button.type = "button";
    button.className = "edf-featured-carousel-action";
    button.ariaLabel = "Pause featured carousel";
    button.append(createSvgIcon(icon => renderPauseIcon(icon, false)));
    attachTooltip(button, "Pause featured carousel", { signal });
    return button;
}

function bindCarouselPauseControl(
    carouselCard: HTMLElement,
    controls: HTMLElement,
    memberCount: number,
    signal: AbortSignal,
): void {
    const existing = controls.querySelector<HTMLButtonElement>('[data-testid="listing-card-carousel-pause"]');
    const button = existing ?? createPauseButton(signal);
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

function removeCarouselPauseControl(carouselCard: HTMLElement, controls: HTMLElement): void {
    controls.querySelector('[data-testid="listing-card-carousel-pause"]')?.remove();
    const state = pausedCarousels.get(carouselCard);
    if (!state) return;

    state.observer.disconnect();
    pausedCarousels.delete(carouselCard);
}

function findChildSlides(carouselCard: HTMLElement): HTMLElement[] {
    return [...carouselCard.querySelectorAll<HTMLElement>(CAROUSEL_CHILD_SELECTOR)];
}

function findSlickSlides(carouselCard: HTMLElement): HTMLElement[] {
    return [...carouselCard.querySelectorAll<HTMLElement>(".slick-slide")];
}

function getSlickSlideUrl(slide: HTMLElement): string | undefined {
    const anchor = findListingAnchor(slide);
    return anchor ? new URL(anchor.href, window.location.origin).href : undefined;
}

function findCarouselShortlistButtons(carouselCard: HTMLElement): HTMLButtonElement[] {
    return [...carouselCard.querySelectorAll<HTMLButtonElement>(
        '[data-testid^="listing-card-shortlist"]',
    )].filter(button => {
        const slide = button.closest<HTMLElement>(".slick-slide");
        return slide ? findListingAnchor(slide) !== undefined : false;
    });
}

function countBoundCarouselPropertyButtons(carouselCard: HTMLElement): number {
    return findCarouselShortlistButtons(carouselCard).filter(button =>
        button.parentElement?.querySelector(
            ':scope > [data-testid="listing-card-blacklist"][data-blacklist-scope="carousel-child"]',
        )
    ).length;
}

function bindCarouselPropertyButtons(
    carouselCard: HTMLElement,
    context: PageContext,
    enabled: boolean,
): void {
    if (!enabled) {
        carouselCard.querySelectorAll(
            '[data-testid="listing-card-blacklist"][data-blacklist-scope="carousel-child"]',
        ).forEach(button => button.remove());
        return;
    }

    for (const shortlistButton of findCarouselShortlistButtons(carouselCard)) {
        const host = shortlistButton.parentElement;
        const slide = shortlistButton.closest<HTMLElement>(".slick-slide");
        const url = slide ? getSlickSlideUrl(slide) : undefined;
        if (!host || !slide || !url) continue;
        if (host.querySelector(
            ':scope > [data-testid="listing-card-blacklist"][data-blacklist-scope="carousel-child"]',
        )) continue;

        const button = createBlacklistAction({
            active: false,
            appearance: "card",
            onToggle: action => toggleBlacklist(
                slide,
                url,
                context,
                shortlistButton,
                action,
            ),
            signal: context.signal,
        });
        button.classList.add("edf-featured-property-blacklist-button");
        button.dataset.blacklistScope = "carousel-child";
        host.classList.add("edf-listing-card-button-container");
        shortlistButton.after(button);
    }
}

function findCarouselListingAnchors(carouselCard: HTMLElement, unique = true): HTMLAnchorElement[] {
    const seen = new Set<string>();
    const primarySlideAnchors = [...carouselCard.querySelectorAll<HTMLElement>(
        ".slick-slide:not(.slick-cloned)",
    )]
        .map(findListingAnchor)
        .filter((anchor): anchor is HTMLAnchorElement => anchor !== undefined);
    const candidates = primarySlideAnchors.length > 0
        ? primarySlideAnchors
        : [...carouselCard.querySelectorAll<HTMLAnchorElement>('a[href]')];

    return candidates
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

function syncCarouselControlForeground(host: HTMLElement, nativeControls: HTMLElement): void {
    // Mirror the sibling stepper's foreground so light/dark agency headers both work.
    const foreground = [...nativeControls.querySelectorAll<HTMLElement>("button")]
        .find(control => !host.contains(control) && control.getClientRects().length > 0);
    if (!foreground) return;
    const color = getComputedStyle(foreground).color;
    if (host.style.getPropertyValue("--edf-featured-fg") !== color) {
        host.style.setProperty("--edf-featured-fg", color);
    }
}

function mountCarouselActionHost(
    carouselCard: HTMLElement,
    host: HTMLElement,
    nativeControls: HTMLElement | undefined,
): void {
    // Keep the controls in the carousel's own layout. A body-level fixed portal followed the
    // viewport rather than the card and drifted whenever Domain made its search toolbar sticky.
    // Domain may replace this row during a slide reconciliation; the action-host observer mounts
    // the same node back into the new row without viewport-coordinate bookkeeping.
    if (!nativeControls) {
        if (host.parentElement !== carouselCard) carouselCard.append(host);
        host.hidden = true;
        return;
    }

    host.hidden = false;
    if (host.parentElement !== nativeControls || host !== nativeControls.firstElementChild) {
        nativeControls.prepend(host);
    }
    syncCarouselControlForeground(host, nativeControls);
}

function getCarouselActionHost(carouselCard: HTMLElement, signal: AbortSignal): HTMLElement {
    let state = carouselActionHosts.get(carouselCard);
    if (!state?.host.isConnected) {
        state?.stop();
        const host = document.createElement("div");
        host.className = "edf-featured-controls";
        host.dataset.testid = "listing-card-featured-controls";
        let frame: number | undefined;
        let settleTimer: number | undefined;
        const syncMount = (): void => {
            if (signal.aborted || !carouselCard.isConnected) {
                removeCarouselActionHost(carouselCard);
                return;
            }
            const previous = carouselCard.querySelector<HTMLButtonElement>(
                'button[aria-label="Previous property"], button[aria-label="Previous"]',
            );
            mountCarouselActionHost(
                carouselCard,
                host,
                previous?.parentElement ?? undefined,
            );
        };
        const remount = (): void => {
            if (frame === undefined) {
                frame = requestAnimationFrame(() => {
                    frame = undefined;
                    syncMount();
                });
            }
            if (settleTimer !== undefined) window.clearTimeout(settleTimer);
            // Domain transitions the stepper foreground when the card changes theme. Re-sample
            // after that transition so an intermediate grey never becomes the persistent mode.
            settleTimer = window.setTimeout(() => {
                settleTimer = undefined;
                syncMount();
            }, 240);
        };
        const observer = new MutationObserver(remount);
        const stop = (): void => {
            observer.disconnect();
            if (frame !== undefined) cancelAnimationFrame(frame);
            if (settleTimer !== undefined) window.clearTimeout(settleTimer);
        };
        state = {
            host,
            observer,
            stop,
        };
        signal.addEventListener("abort", () => {
            if (carouselActionHosts.get(carouselCard)?.host === host) {
                removeCarouselActionHost(carouselCard);
            }
        }, { once: true });
        carouselActionHosts.set(carouselCard, state);
        observer.observe(carouselCard, {
            attributeFilter: ["aria-hidden", "class"],
            attributes: true,
            childList: true,
            subtree: true,
        });
        const previous = carouselCard.querySelector<HTMLButtonElement>(
            'button[aria-label="Previous property"], button[aria-label="Previous"]',
        );
        mountCarouselActionHost(carouselCard, host, previous?.parentElement ?? undefined);
    }
    const host = state.host;
    const previous = carouselCard.querySelector<HTMLButtonElement>(
        'button[aria-label="Previous property"], button[aria-label="Previous"]',
    );
    mountCarouselActionHost(carouselCard, host, previous?.parentElement ?? undefined);
    return host;
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

function observeCarouselHydration(
    carouselCard: HTMLElement,
    memberCount: number,
    context: PageContext,
    options: { enableBlacklist: boolean; enablePause: boolean },
): void {
    const existing = carouselHydrationObservers.get(carouselCard);
    if (existing) {
        existing.memberCount = memberCount;
        existing.options = options;
        return;
    }

    const state: CarouselHydrationState = {
        frame: undefined,
        memberCount,
        options,
        observer: new MutationObserver(() => {
            if (state.frame !== undefined) return;
            state.frame = requestAnimationFrame(() => {
                state.frame = undefined;
                if (!carouselCard.isConnected || context.signal.aborted) {
                    removeCarouselHydrationObserver(carouselCard);
                    return;
                }

                const nextMemberCount = getCarouselMembers(carouselCard).length;
                const nativePropertyActions = findCarouselShortlistButtons(carouselCard).length;
                const boundPropertyActions = countBoundCarouselPropertyButtons(carouselCard);
                const host = carouselActionHosts.get(carouselCard)?.host;
                const needsAggregate = state.options.enableBlacklist && nextMemberCount > 1 &&
                    !host?.querySelector('.edf-featured-blacklist-button');
                const needsPause = state.options.enablePause && nextMemberCount > 1 &&
                    !host?.querySelector('[data-testid="listing-card-carousel-pause"]');
                const needsPropertyActions = state.options.enableBlacklist &&
                    boundPropertyActions !== nativePropertyActions;
                if (
                    nextMemberCount === state.memberCount &&
                    !needsAggregate &&
                    !needsPause &&
                    !needsPropertyActions
                ) return;
                state.memberCount = nextMemberCount;
                bindCarouselCard(carouselCard, context, state.options);
            });
        }),
    };
    carouselHydrationObservers.set(carouselCard, state);
    state.observer.observe(carouselCard, {
        attributeFilter: ["aria-label", "class"],
        attributes: true,
        childList: true,
        subtree: true,
    });
    context.signal.addEventListener(
        "abort",
        () => removeCarouselHydrationObserver(carouselCard),
        { once: true },
    );
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
    showBlacklistedView: boolean,
): void {
    const blacklistedUrls = decisions
        .filter(decision => decision.exclusionReason === "blacklisted")
        .map(decision => decision.url);
    const decisionsByUrl = new Map(
        decisions.map(decision => [decision.url.replace(/\/+$/, ""), decision]),
    );
    const button = carouselActionHosts.get(carouselCard)?.host.querySelector<HTMLButtonElement>(
        '.edf-featured-blacklist-button',
    ) ?? carouselCard.querySelector<HTMLButtonElement>('.edf-featured-blacklist-button');

    if (button) {
        button.hidden = decisions.length === 0;
        setBlacklistActionState(button, {
            active: blacklistedUrls.length > 0,
            label: "Blacklist featured properties",
        });
    }

    const currentSlide = carouselCard.querySelector<HTMLElement>(".slick-slide.slick-current");
    let currentExcluded = false;
    const renderedSlides = findSlickSlides(carouselCard);
    const renderedChildren = findChildSlides(carouselCard);
    for (const child of renderedSlides.length > 0 ? renderedSlides : renderedChildren) {
        const slide = child.matches(".slick-slide")
            ? child
            : child.closest<HTMLElement>(".slick-slide");
        const url = child.matches(".slick-slide")
            ? getSlickSlideUrl(child)
            : getChildListingUrl(child);
        const decision = url ? decisionsByUrl.get(url.replace(/\/+$/, "")) : undefined;

        setCarouselChildDecision(child, decision);
        if (slide === currentSlide && decision && decision.exclusionReason !== "none") {
            currentExcluded = true;
        }
    }

    const allExcluded = decisions.length > 0 &&
        decisions.every(decision => decision.exclusionReason !== "none");
    // In the normal filtered view the empty carousel should disappear. When blacklist rows are
    // enabled, however, the outer card must remain mounted so the generated row is still visible.
    carouselCard.hidden = allExcluded && !showBlacklistedView;

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
    options: { enableBlacklist: boolean; enablePause: boolean },
): void {
    if (!carouselCard.matches(TOPSPOT_CAROUSEL_SELECTOR)) return;

    const members = getCarouselMembers(carouselCard);
    const memberCount = members.length;
    observeCarouselHydration(carouselCard, memberCount, context, options);
    bindCarouselPropertyButtons(carouselCard, context, options.enableBlacklist);

    // A single featured property is a normal listing presented in a carousel-shaped shell.
    // Prefer its own card action. Do not create an aggregate portal at all once that action
    // exists; a body-level empty/fallback host is what previously left duplicate controls.
    if (memberCount <= 1) {
        const state = carouselActionHosts.get(carouselCard);
        if (state) {
            removeCarouselPauseControl(carouselCard, state.host);
            removeCarouselActionHost(carouselCard);
        }
        return;
    }

    const actionHost = getCarouselActionHost(carouselCard, context.signal);
    if (!options.enablePause) removeCarouselPauseControl(carouselCard, actionHost);

    if (!options.enableBlacklist) {
        actionHost.querySelector('.edf-featured-blacklist-button')?.remove();
        if (options.enablePause) {
            bindCarouselPauseControl(carouselCard, actionHost, memberCount, context.signal);
        } else if (actionHost.childElementCount === 0) {
            removeCarouselActionHost(carouselCard);
        }
        return;
    }

    const existingButton = actionHost.querySelector<HTMLButtonElement>('.edf-featured-blacklist-button') ??
        carouselCard.querySelector<HTMLButtonElement>('.edf-featured-blacklist-button');
    if (existingButton) {
        existingButton.hidden = false;
        if (existingButton.parentElement !== actionHost) actionHost.append(existingButton);
        if (options.enablePause) {
            bindCarouselPauseControl(carouselCard, actionHost, memberCount, context.signal);
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
    actionHost.append(button);
    if (options.enablePause) {
        bindCarouselPauseControl(carouselCard, actionHost, memberCount, context.signal);
    }
}
