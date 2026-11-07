import { TOP_LEVEL_CARD_SELECTOR } from "../dom/card";
import { groupMembers } from "./compact";

const GROUP_SELECTOR = '[data-testid="listing-card-exclusion-group"]';
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
    for (const item of getItems()) {
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

        item.animate(
            [
                { height: `${from}px`, overflow: "hidden" },
                { height: `${rect.height}px`, overflow: "hidden" },
            ],
            { duration: DURATION_MS, easing: EASING },
        );
    }
    for (const item of getItems()) if (!groupMembers.has(item)) settled.add(item);
}
