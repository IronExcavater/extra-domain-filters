import { markOwned } from "../../../dom/ownership";
import { TOP_LEVEL_CARD_SELECTOR } from "../dom/card";

const GROUP_SELECTOR = '[data-testid="listing-card-exclusion-group"]';
const HIDDEN_CLASSES = ["edf-listing-card-excluded", "edf-exclusion-group-member"];
const DURATION_MS = 260;
const EASING = "cubic-bezier(0.2, 0, 0, 1)";
// Cards laid out by a previous update. Only these animate, so first paint, pagination and
// infinite scroll render hidden listings straight into the summary instead of collapsing.
const settled = new WeakSet<HTMLElement>();

function getItems(): HTMLElement[] {
    return [...document.querySelectorAll<HTMLElement>(`${TOP_LEVEL_CARD_SELECTOR}, ${GROUP_SELECTOR}`)];
}

function isNearViewport(top: number, bottom: number): boolean {
    return bottom > 0 && top < window.innerHeight;
}

function isHiddenCard(card: HTMLElement): boolean {
    return HIDDEN_CLASSES.some(name => card.classList.contains(name));
}

/**
 * A card being hidden loses its content on the first frame. A static copy of it, laid over
 * the box that replaces it (its own row, or the exit spacer) and clipped by that box's height
 * animation, fades out instead, so the photo dissolves rather than vanishing.
 */
function fadeOutCopy(card: HTMLElement, rect: DOMRect, host: HTMLElement): void {
    const ghost = card.cloneNode(true) as HTMLElement;
    const hostRect = host.getBoundingClientRect();
    ghost.classList.remove(...HIDDEN_CLASSES);
    ghost.classList.add("edf-listing-exit-copy");
    ghost.querySelectorAll(".edf-exclusion-row").forEach(row => row.remove());
    for (const node of [ghost, ...ghost.querySelectorAll("[id], [data-testid]")]) {
        node.removeAttribute("id");
        node.removeAttribute("data-testid");
    }
    ghost.inert = true;
    ghost.setAttribute("aria-hidden", "true");
    Object.assign(ghost.style, {
        height: `${rect.height}px`,
        left: `${rect.left - hostRect.left}px`,
        margin: "0",
        pointerEvents: "none",
        position: "absolute",
        top: `${rect.top - hostRect.top}px`,
        width: `${rect.width}px`,
        zIndex: "1",
    });
    host.append(markOwned(ghost, "listing-exit-copy"));
    void ghost.animate([{ opacity: 1 }, { opacity: 0 }], { duration: DURATION_MS, easing: "ease-out", fill: "forwards" })
        .finished.catch(() => undefined).then(() => ghost.remove());
}

/**
 * A hidden card leaves the list for the hidden-listings summary. A spacer holding its old
 * box (margin included) shrinks to nothing while a copy of the card fades out inside it,
 * so the cards below slide up instead of jumping.
 */
function collapseOut(card: HTMLElement, rect: DOMRect): void {
    const style = getComputedStyle(card);
    const height = rect.height + parseFloat(style.marginTop) + parseFloat(style.marginBottom);
    const spacer = markOwned(document.createElement("div"), "listing-exit-spacer");
    spacer.className = "edf-listing-exit-spacer";
    card.before(spacer);
    fadeOutCopy(card, rect, spacer);
    void spacer.animate([{ height: `${height}px` }, { height: "0px" }], { duration: DURATION_MS, easing: EASING })
        .finished.catch(() => undefined).then(() => spacer.remove());
}

/**
 * Runs `mutate` (which hides, restores or regroups listings) and animates every affected
 * card or summary from its previous height to its new one. Height is animated in flow, so
 * the cards below slide with it. Cards being hidden collapse out; cards coming back open
 * from nothing and fade in.
 */
export function animateListingLayout(mutate: () => void): void {
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
        mutate();
        return;
    }

    const before = new Map<HTMLElement, DOMRect>();
    const wasHidden = new Set<HTMLElement>();
    for (const item of getItems()) {
        before.set(item, item.getBoundingClientRect());
        if (isHiddenCard(item)) wasHidden.add(item);
    }

    mutate();

    for (const item of getItems()) {
        if (!settled.has(item)) continue;
        const was = before.get(item);
        const rect = item.getBoundingClientRect();
        if (was && was.height >= 1 && rect.height < 1) {
            if (isHiddenCard(item) && isNearViewport(was.top, was.bottom)) collapseOut(item, was);
            continue;
        }
        if (rect.height < 1 || !isNearViewport(rect.top, rect.bottom)) continue;

        const from = was && was.height >= 1 ? was.height : 0;
        if (Math.abs(from - rect.height) < 2) continue;
        item.animate(
            [
                { height: `${from}px`, opacity: from === 0 ? 0 : 1, overflow: "hidden" },
                { height: `${rect.height}px`, opacity: 1, overflow: "hidden" },
            ],
            { duration: DURATION_MS, easing: EASING },
        );
        // Pages without a summary keep the hidden card's own row in place.
        if (was && !wasHidden.has(item) && isHiddenCard(item)) fadeOutCopy(item, was, item);
    }
    for (const item of getItems()) settled.add(item);
}
