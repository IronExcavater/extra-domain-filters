import { markOwned } from "../../../dom/ownership";
import { TOP_LEVEL_CARD_SELECTOR } from "../dom/card";
import { groupMembers } from "./compact";

const GROUP_SELECTOR = '[data-testid="listing-card-exclusion-group"]';
const HIDDEN_CLASSES = ["edf-listing-card-excluded", "edf-exclusion-group-member"];
const DURATION_MS = 260;
const EASING = "cubic-bezier(0.2, 0, 0, 1)";
// Cards laid out by a previous update. Only these animate, so first paint, pagination and
// infinite scroll render hidden listings in place instead of visibly collapsing them.
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
 * the box that now holds its row or group and clipped by that box's height animation, fades
 * out instead, so the photo dissolves into the row rather than vanishing.
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
 * Runs `mutate` (which collapses, expands, merges or splits hidden listings) and animates
 * every affected card or group from its previous height to its new one. Because height is
 * animated in flow, the cards below slide with it, so position and size move together.
 * A new group starts from the combined height its members occupied before merging.
 */
export function animateListingLayout(mutate: () => void): void {
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
        mutate();
        return;
    }

    const before = new Map<HTMLElement, number>();
    const shown = new Map<HTMLElement, DOMRect>();
    const hidden = new Set<HTMLElement>();
    for (const item of getItems()) {
        if (!groupMembers.has(item)) {
            const rect = item.getBoundingClientRect();
            if (isHiddenCard(item)) hidden.add(item);
            else if (settled.has(item) && isNearViewport(rect.top, rect.bottom)) shown.set(item, rect);
        }
        const height = item.getBoundingClientRect().height;
        const members = groupMembers.get(item);
        if (members) {
            // Members are display:none inside a group; share the group's height between them
            // so a re-formed group can start from what its members visibly occupied.
            for (const member of members) before.set(member, height / members.length);
        } else if (!before.has(item)) {
            before.set(item, height);
        }
    }

    mutate();

    for (const item of getItems()) {
        const rect = item.getBoundingClientRect();
        if (rect.height < 1 || !isNearViewport(rect.top, rect.bottom)) continue;

        const members = groupMembers.get(item);
        const known = members ? members.every(member => settled.has(member)) : settled.has(item);
        const from = !known
            ? undefined
            : members
                ? members.reduce((sum, member) => sum + (before.get(member) ?? 0), 0)
                : before.get(item);
        if (from === undefined || from < 1 || Math.abs(from - rect.height) < 2) continue;

        // A card coming back fades in as it opens; a card or group taking over hidden cards
        // fades their old content out on top of itself.
        const appearing = !members && hidden.has(item) && !isHiddenCard(item);
        item.animate(
            [
                { height: `${from}px`, opacity: appearing ? 0 : 1, overflow: "hidden" },
                { height: `${rect.height}px`, opacity: 1, overflow: "hidden" },
            ],
            { duration: DURATION_MS, easing: EASING },
        );
        for (const card of members ?? [item]) {
            const previous = shown.get(card);
            if (previous && isHiddenCard(card)) fadeOutCopy(card, previous, item);
        }
    }
    for (const item of getItems()) if (!groupMembers.has(item)) settled.add(item);
}
