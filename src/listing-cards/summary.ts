import { replaceWithBinIcon } from "../core/icons";
import { getBlacklistCardKind, getPropertyCount, getTitle } from "./card";

const SUMMARY_SELECTOR = '[data-testid="listing-card-blacklist-summary"]';
const BLACKLIST_KIND_CLASSES = [
    "edf-blacklist-kind-standard",
    "edf-blacklist-kind-carousel-child",
    "edf-blacklist-kind-project",
    "edf-blacklist-kind-project-child",
];

function getBlacklistSummaryText(card: Element): string {
    const count = getPropertyCount(card);
    const title = getTitle(card);

    if (count > 1) return `${count} properties blacklisted`;

    return `Blacklisted: ${title}`;
}

export function getSummary(card: Element): HTMLElement {
    const existing = card.querySelector<HTMLElement>(SUMMARY_SELECTOR);
    if (existing) return existing;

    const summary = document.createElement("div");
    const text = document.createElement("span");
    const button = document.createElement("button");
    const icon = document.createElementNS("http://www.w3.org/2000/svg", "svg");

    summary.className = "edf-blacklist-summary";
    summary.setAttribute("data-testid", "listing-card-blacklist-summary");

    text.className = "edf-blacklist-summary-text";
    text.setAttribute("data-testid", "listing-card-blacklist-summary-text");

    icon.setAttribute("aria-hidden", "true");
    icon.setAttribute("width", "18");
    icon.setAttribute("height", "18");
    replaceWithBinIcon(icon);

    button.type = "button";
    button.className = "edf-blacklist-summary-button";
    button.setAttribute("data-testid", "listing-card-blacklist-restore");
    button.append(icon, "Unblacklist");

    summary.append(text, button);
    card.prepend(summary);

    return summary;
}

export function applyBlacklistCardState(
    card: Element,
    button: HTMLButtonElement,
    blacklisted: boolean,
): void {
    const kind = getBlacklistCardKind(card, button);

    card.classList.remove(...BLACKLIST_KIND_CLASSES);
    card.classList.add(`edf-blacklist-kind-${kind}`);
    card.classList.toggle("edf-listing-card-blacklisted", blacklisted);
}

export function updateBlacklistSummaryText(card: Element): void {
    const summary = getSummary(card);
    const summaryText = summary.querySelector('[data-testid="listing-card-blacklist-summary-text"]');
    if (summaryText) summaryText.textContent = getBlacklistSummaryText(card);
}
