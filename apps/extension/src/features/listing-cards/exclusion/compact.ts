import { markOwned } from "../../../dom/ownership";
import type { ExclusionReason } from "../../../domain/matching";
import { replaceWithChevronIcon, replaceWithEyeOffIcon, replaceWithFilledBinIcon } from "../../../ui/icons";
import { removeTooltip } from "../../../ui/tooltip";
import {
    findListingAnchor,
    getBlacklistCardKind,
    getThumbnailUrl,
    getTitle,
    TOP_LEVEL_CARD_SELECTOR,
} from "../dom/card";
import { createHiddenRow, resolveExclusionAction, ROW_SELECTOR, setHiddenRowState } from "./row";

const GROUP_SELECTOR = '[data-testid="listing-card-exclusion-group"]';
const GROUPED_CARD_CLASS = "edf-exclusion-group-member";
// One summary per results list; remember the user's choice across re-renders and pages.
let summaryExpanded = false;

type ActiveReason = Exclude<ExclusionReason, "none">;

interface ExcludedCard {
    card: HTMLElement;
    reason: ActiveReason;
    urls: string[];
}

/** Summary section → the hidden cards it stands in for. */
const groupMembers = new WeakMap<HTMLElement, HTMLElement[]>();

function getExcludedCard(element: Element): ExcludedCard | undefined {
    if (!(element instanceof HTMLElement) || !element.matches(TOP_LEVEL_CARD_SELECTOR)) return undefined;
    const kind = getBlacklistCardKind(element);
    if (kind === "project-child" || kind === "carousel-child") return undefined;
    if (!element.classList.contains("edf-listing-card-excluded")) return undefined;

    // Only a row owned by this card (not a child listing's) describes the whole card.
    const row = element.querySelector<HTMLElement>(`:scope > ${ROW_SELECTOR}`) ??
        element.querySelector<HTMLElement>(ROW_SELECTOR);
    const reason = row?.dataset.exclusionReason as ActiveReason | undefined;
    const rawUrls = row?.dataset.exclusionUrls;
    if ((reason !== "blacklisted" && reason !== "filtered") || !rawUrls) return undefined;

    try {
        const urls = JSON.parse(rawUrls);
        return Array.isArray(urls) && urls.every(url => typeof url === "string")
            ? { card: element, reason, urls }
            : undefined;
    } catch {
        return undefined;
    }
}

function setExpanded(group: HTMLElement, expanded: boolean, animate = true): void {
    const body = group.querySelector<HTMLElement>('[data-testid="listing-card-exclusion-group-body"]');
    const header = group.querySelector<HTMLButtonElement>('[data-testid="listing-card-exclusion-group-toggle"]');
    if (!body || !header) return;

    const from = body.getBoundingClientRect().height;
    group.dataset.expanded = String(expanded);
    body.hidden = !expanded;
    header.setAttribute("aria-expanded", String(expanded));
    if (!animate || window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    const to = expanded ? body.getBoundingClientRect().height : 0;
    if (!expanded) body.hidden = false;
    const animation = body.animate(
        [{ height: `${from}px`, opacity: expanded ? 0 : 1 }, { height: `${to}px`, opacity: expanded ? 1 : 0 }],
        { duration: 220, easing: "cubic-bezier(0.2, 0, 0, 1)" },
    );
    if (!expanded) animation.addEventListener("finish", () => {
        if (group.dataset.expanded === "false") body.hidden = true;
    });
}

function createGroupItem(item: ExcludedCard): HTMLElement {
    const row = createHiddenRow({
        href: findListingAnchor(item.card)?.href,
        thumbnail: getThumbnailUrl(item.card) ?? "",
    });
    row.classList.add("edf-exclusion-group-item");
    // The card's own row already carries any specific reason ("Agency: …").
    const reason = item.card.querySelector(`${ROW_SELECTOR} .edf-exclusion-row-reason`)?.textContent?.trim();
    const detail = reason && reason !== "Blacklisted" && reason !== "Filtered" ? reason : undefined;
    row.classList.toggle("edf-exclusion-row-detailed", detail !== undefined);
    setHiddenRowState(row, {
        detail,
        onAction: () => resolveExclusionAction(item.urls, item.reason),
        reason: item.reason,
        // Reuse the card's own row title: it already reads correctly for projects
        // ("… (8 properties)") and featured carousels.
        title: item.card.querySelector(`${ROW_SELECTOR} .edf-exclusion-row-title`)?.textContent?.trim() ||
            getTitle(item.card),
        urls: item.urls,
    });
    return row;
}

function createSummary(): HTMLElement {
    const section = markOwned(document.createElement("section"), "hidden-listings-summary");
    const header = document.createElement("button");
    const icon = document.createElementNS("http://www.w3.org/2000/svg", "svg");
    const text = document.createElement("span");
    const title = document.createElement("span");
    const reason = document.createElement("span");
    const toggle = document.createElement("span");
    const chevron = document.createElementNS("http://www.w3.org/2000/svg", "svg");
    const body = document.createElement("div");

    section.className = "edf-exclusion-group";
    section.setAttribute("data-testid", "listing-card-exclusion-group");
    header.type = "button";
    header.className = "edf-exclusion-group-header";
    header.setAttribute("data-testid", "listing-card-exclusion-group-toggle");
    icon.classList.add("edf-exclusion-row-icon");
    icon.setAttribute("aria-hidden", "true");
    icon.setAttribute("width", "18");
    icon.setAttribute("height", "18");
    text.className = "edf-exclusion-row-text";
    title.className = "edf-exclusion-row-title";
    reason.className = "edf-exclusion-row-reason";
    text.append(title, reason);
    toggle.className = "edf-exclusion-group-toggle";
    chevron.classList.add("edf-exclusion-group-chevron");
    chevron.setAttribute("aria-hidden", "true");
    chevron.setAttribute("width", "16");
    chevron.setAttribute("height", "16");
    replaceWithChevronIcon(chevron);
    toggle.append(document.createElement("span"), chevron);
    header.append(icon, text, toggle);

    body.className = "edf-exclusion-group-body";
    body.setAttribute("data-testid", "listing-card-exclusion-group-body");
    section.append(header, body);

    header.addEventListener("click", event => {
        event.preventDefault();
        event.stopPropagation();
        summaryExpanded = section.dataset.expanded !== "true";
        setExpanded(section, summaryExpanded);
        updateToggleLabel(section);
    });
    setExpanded(section, summaryExpanded, false);
    return section;
}

function updateToggleLabel(section: HTMLElement): void {
    const label = section.querySelector(".edf-exclusion-group-toggle > span");
    if (label) label.textContent = section.dataset.expanded === "true" ? "Hide" : "Show";
}

function renderSummary(section: HTMLElement, items: ExcludedCard[]): void {
    const signature = items.map(item => `${item.reason}:${item.urls.join(",")}`).join("|");
    if (section.dataset.signature === signature) return;
    section.dataset.signature = signature;

    const reasons = new Set(items.map(item => item.reason));
    const blacklisted = items.filter(item => item.reason === "blacklisted").length;
    const filtered = items.length - blacklisted;
    const label = `${items.length} hidden listing${items.length === 1 ? "" : "s"}`;
    section.dataset.exclusionReason = reasons.size > 1 ? "mixed" : [...reasons][0];
    section.querySelector(".edf-exclusion-row-title")!.textContent = label;
    section.querySelector(".edf-exclusion-row-reason")!.textContent = [
        blacklisted ? `${blacklisted} blacklisted` : "",
        filtered ? `${filtered} filtered` : "",
    ].filter(Boolean).join(" · ");
    section.querySelector("button")!.setAttribute("aria-label", label);
    const icon = section.querySelector<SVGSVGElement>(".edf-exclusion-group-header .edf-exclusion-row-icon")!;
    (reasons.has("blacklisted") ? replaceWithFilledBinIcon : replaceWithEyeOffIcon)(icon);
    updateToggleLabel(section);

    const body = section.querySelector<HTMLElement>('[data-testid="listing-card-exclusion-group-body"]')!;
    body.querySelectorAll<HTMLElement>("[aria-describedby]").forEach(removeTooltip);
    body.replaceChildren(...items.map(createGroupItem));
}

function removeSummary(section: HTMLElement): void {
    for (const card of groupMembers.get(section) ?? []) card.classList.remove(GROUPED_CARD_CLASS);
    section.querySelectorAll<HTMLElement>("[aria-describedby]").forEach(removeTooltip);
    section.remove();
}

/**
 * Collects every hidden listing in a results list (properties, projects and featured
 * carousels alike) into one collapsed summary at the end of that list, so hidden listings
 * never break up the results. The summary is updated in place across re-renders.
 */
export function compactExcludedListingCards(): void {
    const parents = new Set(
        [...document.querySelectorAll(TOP_LEVEL_CARD_SELECTOR)]
            .map(card => card.parentElement)
            .filter((parent): parent is HTMLElement => parent !== null),
    );
    for (const section of document.querySelectorAll<HTMLElement>(GROUP_SELECTOR)) {
        if (!section.parentElement || !parents.has(section.parentElement)) removeSummary(section);
    }

    for (const parent of parents) {
        const items: ExcludedCard[] = [];
        for (const child of parent.children) {
            const item = getExcludedCard(child);
            if (item) items.push(item);
            else if (child.classList.contains(GROUPED_CARD_CLASS)) child.classList.remove(GROUPED_CARD_CLASS);
        }

        const existing = parent.querySelector<HTMLElement>(`:scope > ${GROUP_SELECTOR}`);
        if (items.length === 0) {
            if (existing) removeSummary(existing);
            continue;
        }
        for (const item of items) {
            if (!item.card.classList.contains(GROUPED_CARD_CLASS)) item.card.classList.add(GROUPED_CARD_CLASS);
        }
        const section = existing ?? createSummary();
        renderSummary(section, items);
        groupMembers.set(section, items.map(item => item.card));
        // Domain appends further results after it; keep the summary last.
        if (parent.lastElementChild !== section) parent.append(section);
    }
}
