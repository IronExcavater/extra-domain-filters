import { removeBlacklistUrls } from "../../../domain/blacklist/store";
import { type ExclusionReason } from "../../../domain/matching";
import { replaceWithEyeIcon, replaceWithEyeOffIcon, replaceWithFilledBinIcon, replaceWithUnbinIcon } from "../../../ui/icons";
import { setTooltipText } from "../../../ui/tooltip";
import { getBlacklistCardKind, getPropertyCount, getTitle, type BlacklistCardKind } from "../dom/card";
import { reveal, unreveal } from "./reveal";

export const ROW_SELECTOR = '[data-testid="listing-card-exclusion-row"]';
const KIND_CLASSES = [
    "edf-exclusion-kind-standard",
    "edf-exclusion-kind-carousel",
    "edf-exclusion-kind-carousel-child",
    "edf-exclusion-kind-project",
    "edf-exclusion-kind-project-child",
];

type ActiveReason = Exclude<ExclusionReason, "none">;
const ICON_STATE_ATTRIBUTE = "data-edf-icon-state";

export function getExclusionSummaryText(card: Element, _reason: ActiveReason): string {
    const count = getPropertyCount(card);
    const title = getTitle(card);

    return count > 1 ? `${title} (${count} properties)` : title;
}

export async function resolveExclusionAction(url: string | readonly string[], reason: ActiveReason): Promise<void> {
    if (reason === "filtered") {
        for (const currentUrl of [url].flat()) reveal(currentUrl);
        return;
    }

    await removeBlacklistUrls(url);
}

const REASON_LABELS: Record<ActiveReason, { action: string; reason: string }> = {
    blacklisted: { action: "Unblacklist", reason: "Blacklisted" },
    filtered: { action: "Show", reason: "Filtered" },
};

function createIcon(className: string, size: number): SVGSVGElement {
    const icon = document.createElementNS("http://www.w3.org/2000/svg", "svg");
    icon.classList.add(className);
    icon.setAttribute("aria-hidden", "true");
    icon.setAttribute("width", String(size));
    icon.setAttribute("height", String(size));
    return icon;
}

export interface HiddenRowOptions {
    /** Listing page the title links to. */
    href?: string;
    /** Shows a photo thumbnail (or a placeholder when empty) instead of the reason glyph. */
    thumbnail?: string;
}

/**
 * One hidden-listing row for both reasons, used inside cards (project/featured children) and
 * as the items of the hidden-listings summary: glyph or thumbnail, title + reason, and a
 * labelled restore action.
 */
export function createHiddenRow(options: HiddenRowOptions = {}): HTMLElement {
    const row = document.createElement("div");
    const text = document.createElement("span");
    const title = document.createElement(options.href ? "a" : "span");
    const reason = document.createElement("span");
    const button = document.createElement("button");
    const label = document.createElement("span");

    row.className = "edf-exclusion-row";
    row.setAttribute("data-testid", "listing-card-exclusion-row");
    if (options.thumbnail === undefined) {
        row.append(createIcon("edf-exclusion-row-icon", 18));
    } else {
        const thumbnail = document.createElement("span");
        thumbnail.className = "edf-exclusion-row-thumb";
        if (options.thumbnail) {
            const image = document.createElement("img");
            image.alt = "";
            image.loading = "lazy";
            image.src = options.thumbnail;
            thumbnail.append(image);
        }
        row.append(thumbnail);
    }
    text.className = "edf-exclusion-row-text";
    title.className = "edf-exclusion-row-title";
    title.setAttribute("data-testid", "listing-card-exclusion-row-text");
    if (title instanceof HTMLAnchorElement && options.href) title.href = options.href;
    reason.className = "edf-exclusion-row-reason";
    text.append(title, reason);
    button.type = "button";
    button.className = "edf-exclusion-row-button";
    button.setAttribute("data-testid", "listing-card-exclusion-restore");
    label.className = "edf-exclusion-row-button-label";
    button.append(createIcon("edf-exclusion-row-action-icon", 16), label);
    row.append(text, button);
    return row;
}

export function setHiddenRowState(
    row: HTMLElement,
    state: {
        /** Replaces the generic reason, e.g. "Agency: Ray White Yamba". */
        detail?: string;
        onAction(): Promise<void> | void;
        reason: ActiveReason;
        title: string;
        urls: readonly string[];
    },
): void {
    const title = row.querySelector<HTMLElement>(".edf-exclusion-row-title");
    const reason = row.querySelector<HTMLElement>(".edf-exclusion-row-reason");
    const button = row.querySelector<HTMLButtonElement>(".edf-exclusion-row-button");
    const label = row.querySelector<HTMLElement>(".edf-exclusion-row-button-label");
    const icon = row.querySelector<SVGSVGElement>(".edf-exclusion-row-icon");
    const actionIcon = row.querySelector<SVGSVGElement>(".edf-exclusion-row-action-icon");
    const labels = REASON_LABELS[state.reason];
    const nextUrls = JSON.stringify(state.urls);

    if (title && title.textContent !== state.title) title.textContent = state.title;
    const reasonText = state.detail ?? labels.reason;
    if (reason && reason.textContent !== reasonText) reason.textContent = reasonText;
    if (label && label.textContent !== labels.action) label.textContent = labels.action;
    if (row.dataset.exclusionReason !== state.reason) row.dataset.exclusionReason = state.reason;
    if (row.dataset.exclusionUrls !== nextUrls) row.dataset.exclusionUrls = nextUrls;
    if (actionIcon && actionIcon.getAttribute(ICON_STATE_ATTRIBUTE) !== state.reason) {
        if (icon) (state.reason === "blacklisted" ? replaceWithFilledBinIcon : replaceWithEyeOffIcon)(icon);
        (state.reason === "blacklisted" ? replaceWithUnbinIcon : replaceWithEyeIcon)(actionIcon);
        actionIcon.setAttribute(ICON_STATE_ATTRIBUTE, state.reason);
    }
    if (button) {
        const ariaLabel = `${labels.action} ${state.title}`;
        if (button.ariaLabel !== ariaLabel) button.ariaLabel = ariaLabel;
        button.onclick = async event => {
            event.preventDefault();
            event.stopPropagation();
            button.disabled = true;
            try {
                await state.onAction();
            } finally {
                button.disabled = false;
            }
        };
    }
}

export function getExclusionRow(card: Element): HTMLElement {
    const existing = card.querySelector<HTMLElement>(`:scope > ${ROW_SELECTOR}`) ??
        card.querySelector<HTMLElement>(ROW_SELECTOR);
    if (existing) return existing;

    const row = createHiddenRow();
    card.prepend(row);
    return row;
}

export function updateExclusionRow(
    card: Element,
    url: string | readonly string[],
    reason: ActiveReason,
    detail?: string,
): void {
    setHiddenRowState(getExclusionRow(card), {
        detail,
        onAction: () => resolveExclusionAction(url, reason),
        reason,
        title: getExclusionSummaryText(card, reason),
        urls: [url].flat(),
    });
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
