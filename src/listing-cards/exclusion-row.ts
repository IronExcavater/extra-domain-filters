import {
    replaceWithBinIcon,
    replaceWithEyeIcon,
    replaceWithEyeOffIcon,
} from "../core/icons";
import { getFromStorage, setInStorage } from "../core/storage";
import {
    removeBlacklistEntry,
    type BlacklistEntry,
    type ExclusionReason,
} from "../matching";
import { getBlacklistCardKind, getPropertyCount, getTitle, type BlacklistCardKind } from "./card";
import { isRevealed, reveal, unreveal } from "./reveal";

const ROW_SELECTOR = '[data-testid="listing-card-exclusion-row"]';
const KIND_CLASSES = [
    "edf-exclusion-kind-standard",
    "edf-exclusion-kind-carousel-child",
    "edf-exclusion-kind-project",
    "edf-exclusion-kind-project-child",
];

// Only ever called with "blacklisted" or "filtered" — "none" never reaches a row (the card is
// shown normally instead).
type ActiveReason = Exclude<ExclusionReason, "none">;

export function getExclusionSummaryText(card: Element, reason: ActiveReason): string {
    const count = getPropertyCount(card);
    const title = getTitle(card);

    if (reason === "blacklisted") {
        return count > 1 ? `${count} properties blacklisted` : `Blacklisted: ${title}`;
    }

    return count > 1 ? `${count} properties filtered out` : `Filtered out: ${title}`;
}

// Only ever called to undo an existing exclusion (the row/group action button only appears on
// already-excluded listings) — never to add a new one, so it needs no ListingSnapshot.
export async function resolveExclusionAction(url: string, reason: ActiveReason): Promise<void> {
    if (reason === "filtered") {
        reveal(url);
        return;
    }

    const current = (await getFromStorage<BlacklistEntry[]>("blacklist")) ?? [];
    await setInStorage("blacklist", removeBlacklistEntry(current, url));
}

export function getExclusionRow(card: Element): HTMLElement {
    const existing = card.querySelector<HTMLElement>(ROW_SELECTOR);
    if (existing) return existing;

    const row = document.createElement("div");
    const text = document.createElement("span");
    const button = document.createElement("button");
    const icon = document.createElementNS("http://www.w3.org/2000/svg", "svg");

    row.className = "edf-exclusion-row";
    row.setAttribute("data-testid", "listing-card-exclusion-row");

    text.className = "edf-exclusion-row-text";
    text.setAttribute("data-testid", "listing-card-exclusion-row-text");

    icon.setAttribute("aria-hidden", "true");
    icon.setAttribute("width", "18");
    icon.setAttribute("height", "18");

    button.type = "button";
    button.className = "edf-exclusion-row-button";
    button.setAttribute("data-testid", "listing-card-exclusion-restore");
    button.append(icon, "");

    row.append(text, button);
    card.prepend(row);

    return row;
}

export function updateExclusionRow(card: Element, url: string, reason: ActiveReason): void {
    const row = getExclusionRow(card);
    const text = row.querySelector<HTMLElement>('[data-testid="listing-card-exclusion-row-text"]');
    const button = row.querySelector<HTMLButtonElement>('[data-testid="listing-card-exclusion-restore"]');
    const icon = button?.querySelector("svg");

    if (text) text.textContent = getExclusionSummaryText(card, reason);

    if (icon) (reason === "blacklisted" ? replaceWithBinIcon : replaceWithEyeIcon)(icon);

    if (button) {
        const label = reason === "blacklisted" ? "Unblacklist" : "Show anyway";
        button.lastChild!.textContent = label;
        button.ariaLabel = label;
        button.onclick = async event => {
            event.preventDefault();
            event.stopPropagation();
            await resolveExclusionAction(url, reason);
        };
    }
}

export function applyExclusionState(
    card: Element,
    button: HTMLButtonElement,
    reason: ExclusionReason,
): void {
    const kind: BlacklistCardKind = getBlacklistCardKind(card, button);

    card.classList.remove(...KIND_CLASSES);
    card.classList.add(`edf-exclusion-kind-${kind}`);
    card.classList.toggle("edf-listing-card-excluded", reason !== "none");
    (card as HTMLElement).dataset.exclusionReason = reason;
}

// Placed on the real, expanded card content for a "filtered" listing that's currently revealed,
// so the user can re-hide it without waiting for filters to change. Idempotent — safe to call on
// every refresh.
const EYE_OFF_SELECTOR = '[data-testid="listing-card-hide-again"]';

export function ensureHideAgainAffordance(card: Element, url: string): void {
    if (card.querySelector(EYE_OFF_SELECTOR)) return;

    const button = document.createElement("button");
    const icon = document.createElementNS("http://www.w3.org/2000/svg", "svg");

    button.type = "button";
    button.className = "edf-hide-again-button";
    button.setAttribute("data-testid", "listing-card-hide-again");
    button.ariaLabel = "Hide this listing again";
    button.title = "Hide this listing again";

    icon.setAttribute("aria-hidden", "true");
    icon.setAttribute("width", "16");
    icon.setAttribute("height", "16");
    replaceWithEyeOffIcon(icon);

    button.append(icon);
    button.addEventListener("click", event => {
        event.preventDefault();
        event.stopPropagation();
        unreveal(url);
    });

    card.appendChild(button);
}

export function removeHideAgainAffordance(card: Element): void {
    card.querySelector(EYE_OFF_SELECTOR)?.remove();
}

export { isRevealed };
