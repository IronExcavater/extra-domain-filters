import { removeBlacklistUrls } from "../../../domain/blacklist/store";
import { type ExclusionReason } from "../../../domain/matching";
import { replaceWithEyeIcon, replaceWithEyeOffIcon, replaceWithUnbinIcon } from "../../../shared/ui/icons";
import { setTooltipText } from "../../../shared/ui/tooltip";
import { getBlacklistCardKind, getPropertyCount, getTitle, type BlacklistCardKind } from "../dom/card";
import { isRevealed, reveal, unreveal } from "./reveal";

const ROW_SELECTOR = '[data-testid="listing-card-exclusion-row"]';
const KIND_CLASSES = [
    "edf-exclusion-kind-standard",
    "edf-exclusion-kind-carousel",
    "edf-exclusion-kind-carousel-child",
    "edf-exclusion-kind-project",
    "edf-exclusion-kind-project-child",
];

type ActiveReason = Exclude<ExclusionReason, "none">;
const ICON_STATE_ATTRIBUTE = "data-edf-icon-state";

export function getExclusionSummaryText(card: Element, reason: ActiveReason): string {
    const count = getPropertyCount(card);
    const title = getTitle(card);

    if (reason === "blacklisted") {
        return title;
    }

    return count > 1 ? `${count} properties filtered out` : `Filtered out: ${title}`;
}

export async function resolveExclusionAction(url: string | readonly string[], reason: ActiveReason): Promise<void> {
    if (reason === "filtered") {
        for (const currentUrl of [url].flat()) reveal(currentUrl);
        return;
    }

    await removeBlacklistUrls(url);
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
    button.append(icon);

    row.append(text, button);
    card.prepend(row);

    return row;
}

export function updateExclusionRow(
    card: Element,
    url: string | readonly string[],
    reason: ActiveReason,
): void {
    const row = getExclusionRow(card);
    const text = row.querySelector<HTMLElement>('[data-testid="listing-card-exclusion-row-text"]');
    const button = row.querySelector<HTMLButtonElement>('[data-testid="listing-card-exclusion-restore"]');
    const icon = button?.querySelector("svg");
    const urls = [url].flat();

    const nextText = getExclusionSummaryText(card, reason);
    const nextUrls = JSON.stringify(urls);

    if (text && text.textContent !== nextText) text.textContent = nextText;
    if (row.dataset.exclusionReason !== reason) row.dataset.exclusionReason = reason;
    if (row.dataset.exclusionUrls !== nextUrls) row.dataset.exclusionUrls = nextUrls;

    if (icon && icon.getAttribute(ICON_STATE_ATTRIBUTE) !== reason) {
        (reason === "blacklisted" ? replaceWithUnbinIcon : replaceWithEyeIcon)(icon);
        icon.setAttribute(ICON_STATE_ATTRIBUTE, reason);
    }

    if (button) {
        const label = reason === "blacklisted" ? "Unblacklist" : "Show anyway";
        if (button.ariaLabel !== label) button.ariaLabel = label;
        setTooltipText(button, label);
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
    const element = card as HTMLElement;
    const kindClass = `edf-exclusion-kind-${kind}`;

    if (!card.classList.contains(kindClass)) {
        card.classList.remove(...KIND_CLASSES);
        card.classList.add(kindClass);
    }
    card.classList.toggle("edf-listing-card-excluded", reason !== "none");
    if (element.dataset.exclusionReason !== reason) element.dataset.exclusionReason = reason;
}

const EYE_OFF_SELECTOR = '[data-testid="listing-card-hide-again"]';

export function ensureHideAgainAffordance(card: Element, url: string): void {
    if (card.querySelector(EYE_OFF_SELECTOR)) return;

    const button = document.createElement("button");
    const icon = document.createElementNS("http://www.w3.org/2000/svg", "svg");

    button.type = "button";
    button.className = "edf-hide-again-button";
    button.setAttribute("data-testid", "listing-card-hide-again");
    button.ariaLabel = "Hide this listing again";
    setTooltipText(button, "Hide this listing again");

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
