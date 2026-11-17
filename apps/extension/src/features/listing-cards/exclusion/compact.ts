import { markOwned } from "../../../dom/ownership";
import type { ExclusionReason } from "../../../domain/matching";
import { createSvgIcon } from "../../../ui/elements";
import { replaceWithChevronIcon, replaceWithEyeIcon, replaceWithUnbinIcon } from "../../../ui/icons";
import { removeTooltip } from "../../../ui/tooltip";
import {
    findListingAnchor,
    getBlacklistCardKind,
    getThumbnailUrl,
    getTitle,
    TOP_LEVEL_CARD_SELECTOR,
} from "../dom/card";
import { reveal } from "./reveal";
import { resolveExclusionAction, ROW_SELECTOR } from "./row";

const GROUP_SELECTOR = '[data-testid="listing-card-exclusion-group"]';
const GROUPED_CARD_CLASS = "edf-exclusion-group-member";
const PREVIEW_COUNT = 3;
// One summary per page; remember the user's choice across re-renders and pages.
let summaryExpanded = false;

type ActiveReason = Exclude<ExclusionReason, "none">;

interface ExcludedCard {
    card: HTMLElement;
    details: string[];
    price?: string;
    reason: ActiveReason;
    thumbnail?: string;
    title: string;
    href?: string;
    urls: string[];
}

/** Summary section → the hidden cards it stands in for. */
const groupMembers = new WeakMap<HTMLElement, HTMLElement[]>();

function readJsonList(value: string | undefined): string[] {
    try {
        const list = JSON.parse(value ?? "[]");
        return Array.isArray(list) ? list.filter((item): item is string => typeof item === "string") : [];
    } catch {
        return [];
    }
}

function getExcludedCard(element: Element): ExcludedCard | undefined {
    if (!(element instanceof HTMLElement) || !element.matches(TOP_LEVEL_CARD_SELECTOR)) return undefined;
    const kind = getBlacklistCardKind(element);
    if (kind === "project-child" || kind === "carousel-child") return undefined;
    if (!element.classList.contains("edf-listing-card-excluded")) return undefined;

    // Only a row owned by this card (not a child listing's) describes the whole card.
    const row = element.querySelector<HTMLElement>(`:scope > ${ROW_SELECTOR}`) ??
        element.querySelector<HTMLElement>(ROW_SELECTOR);
    const reason = row?.dataset.exclusionReason as ActiveReason | undefined;
    const urls = readJsonList(row?.dataset.exclusionUrls);
    if ((reason !== "blacklisted" && reason !== "filtered") || urls.length === 0) return undefined;

    return {
        card: element,
        details: readJsonList(row?.dataset.exclusionDetails),
        href: findListingAnchor(element)?.href,
        price: element.querySelector('[data-testid="listing-card-price"]')?.textContent?.trim() || undefined,
        reason,
        thumbnail: getThumbnailUrl(element),
        // The card's own row title already reads well for projects ("… (8 properties)").
        title: row?.querySelector(".edf-exclusion-row-title")?.textContent?.trim() || getTitle(element),
        urls,
    };
}

function setExpanded(section: HTMLElement, expanded: boolean, animate = true): void {
    const body = section.querySelector<HTMLElement>('[data-testid="listing-card-exclusion-group-body"]');
    const header = section.querySelector<HTMLButtonElement>('[data-testid="listing-card-exclusion-group-toggle"]');
    const label = section.querySelector(".edf-hidden-summary-toggle-label");
    if (!body || !header) return;

    const from = body.getBoundingClientRect().height;
    section.dataset.expanded = String(expanded);
    body.hidden = !expanded;
    header.setAttribute("aria-expanded", String(expanded));
    if (label) label.textContent = expanded ? "Hide" : "Show";
    if (!animate || window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    const to = expanded ? body.getBoundingClientRect().height : 0;
    if (!expanded) body.hidden = false;
    const animation = body.animate(
        [{ height: `${from}px`, opacity: expanded ? 0 : 1 }, { height: `${to}px`, opacity: expanded ? 1 : 0 }],
        { duration: 240, easing: "cubic-bezier(0.2, 0, 0, 1)" },
    );
    if (!expanded) animation.addEventListener("finish", () => {
        if (section.dataset.expanded === "false") body.hidden = true;
    });
}

function createThumbnail(url: string | undefined, className: string): HTMLElement {
    const frame = document.createElement("span");
    frame.className = className;
    frame.ariaHidden = "true";
    if (url) {
        const image = document.createElement("img");
        image.alt = "";
        image.loading = "lazy";
        image.src = url;
        frame.append(image);
    }
    return frame;
}

/** One hidden listing: photo, address, price, why it's hidden, and the way back. */
function createItem(item: ExcludedCard): HTMLElement {
    const row = document.createElement("li");
    const text = document.createElement("div");
    const title = document.createElement(item.href ? "a" : "span");
    const action = document.createElement("button");
    const blacklisted = item.reason === "blacklisted";

    row.className = "edf-hidden-item";
    text.className = "edf-hidden-item-text";
    title.className = "edf-hidden-item-title";
    title.textContent = item.title;
    if (title instanceof HTMLAnchorElement && item.href) title.href = item.href;
    text.append(title);
    if (item.price) {
        const price = document.createElement("span");
        price.className = "edf-hidden-item-price";
        price.textContent = item.price;
        text.append(price);
    }
    if (item.details.length > 0) {
        const reasons = document.createElement("span");
        reasons.className = "edf-hidden-item-reasons";
        for (const detail of item.details) {
            const chip = document.createElement("span");
            chip.className = "edf-hidden-item-reason";
            chip.textContent = detail;
            reasons.append(chip);
        }
        text.append(reasons);
    }
    action.type = "button";
    action.className = "edf-hidden-item-action";
    action.ariaLabel = `${blacklisted ? "Unblacklist" : "Show"} ${item.title}`;
    action.append(
        createSvgIcon(blacklisted ? replaceWithUnbinIcon : replaceWithEyeIcon),
        blacklisted ? "Unblacklist" : "Show",
    );
    action.addEventListener("click", async event => {
        event.preventDefault();
        event.stopPropagation();
        action.disabled = true;
        row.dataset.leaving = "true";
        try {
            await resolveExclusionAction(item.urls, item.reason);
        } finally {
            action.disabled = false;
        }
    });
    row.append(createThumbnail(item.thumbnail, "edf-hidden-item-photo"), text, action);
    return row;
}

function createGroup(title: string, items: ExcludedCard[], action?: HTMLButtonElement): HTMLElement {
    const group = document.createElement("section");
    const head = document.createElement("div");
    const heading = document.createElement("h3");
    const count = document.createElement("span");
    const list = document.createElement("ul");
    group.className = "edf-hidden-group";
    head.className = "edf-hidden-group-head";
    heading.className = "edf-hidden-group-title";
    count.className = "edf-hidden-group-count";
    count.textContent = String(items.length);
    heading.append(title, count);
    head.append(heading, ...(action ? [action] : []));
    list.className = "edf-hidden-group-list";
    list.append(...items.map(createItem));
    group.append(head, list);
    return group;
}

function createSummary(): HTMLElement {
    const section = markOwned(document.createElement("section"), "hidden-listings-summary");
    const header = document.createElement("button");
    const previews = document.createElement("span");
    const text = document.createElement("span");
    const title = document.createElement("span");
    const breakdown = document.createElement("span");
    const toggle = document.createElement("span");
    const toggleLabel = document.createElement("span");
    const body = document.createElement("div");

    section.className = "edf-exclusion-group edf-hidden-summary";
    section.setAttribute("data-testid", "listing-card-exclusion-group");
    header.type = "button";
    header.className = "edf-hidden-summary-header";
    header.setAttribute("data-testid", "listing-card-exclusion-group-toggle");
    previews.className = "edf-hidden-summary-previews";
    text.className = "edf-hidden-summary-text";
    title.className = "edf-hidden-summary-title";
    breakdown.className = "edf-hidden-summary-breakdown";
    text.append(title, breakdown);
    toggle.className = "edf-hidden-summary-toggle";
    toggleLabel.className = "edf-hidden-summary-toggle-label";
    toggle.append(toggleLabel, createSvgIcon(replaceWithChevronIcon, "edf-hidden-summary-chevron"));
    header.append(previews, text, toggle);
    body.className = "edf-hidden-summary-body";
    body.setAttribute("data-testid", "listing-card-exclusion-group-body");
    section.append(header, body);

    header.addEventListener("click", event => {
        event.preventDefault();
        event.stopPropagation();
        summaryExpanded = section.dataset.expanded !== "true";
        setExpanded(section, summaryExpanded);
    });
    setExpanded(section, summaryExpanded, false);
    return section;
}

function renderSummary(section: HTMLElement, items: ExcludedCard[]): void {
    const signature = items.map(item => `${item.reason}:${item.urls.join(",")}:${item.details.join("|")}`).join(";");
    if (section.dataset.signature === signature) return;
    section.dataset.signature = signature;

    const blacklisted = items.filter(item => item.reason === "blacklisted");
    const filtered = items.filter(item => item.reason === "filtered");
    const label = `${items.length} ${items.length === 1 ? "listing" : "listings"} hidden`;
    section.dataset.exclusionReason = blacklisted.length > 0 && filtered.length > 0
        ? "mixed"
        : items[0].reason;
    section.querySelector(".edf-hidden-summary-title")!.textContent = label;
    section.querySelector(".edf-hidden-summary-breakdown")!.replaceChildren(...[
        blacklisted.length > 0 && `${blacklisted.length} blacklisted`,
        filtered.length > 0 && `${filtered.length} by your filters`,
    ].filter((part): part is string => typeof part === "string").map(part => {
        const chip = document.createElement("span");
        chip.className = "edf-hidden-summary-chip";
        chip.textContent = part;
        return chip;
    }));
    section.querySelector(".edf-hidden-summary-previews")!.replaceChildren(
        ...items.slice(0, PREVIEW_COUNT).map(item => createThumbnail(item.thumbnail, "edf-hidden-summary-preview")),
    );
    section.querySelector("button")!.setAttribute("aria-label", label);

    const body = section.querySelector<HTMLElement>('[data-testid="listing-card-exclusion-group-body"]')!;
    body.querySelectorAll<HTMLElement>("[aria-describedby]").forEach(removeTooltip);
    const groups: HTMLElement[] = [];
    if (blacklisted.length > 0) groups.push(createGroup("Blacklisted", blacklisted));
    if (filtered.length > 0) {
        const showAll = document.createElement("button");
        showAll.type = "button";
        showAll.className = "edf-hidden-group-action";
        showAll.textContent = filtered.length === 1 ? "Show it" : `Show all ${filtered.length}`;
        showAll.addEventListener("click", event => {
            event.preventDefault();
            event.stopPropagation();
            for (const item of filtered) item.urls.forEach(reveal);
        });
        groups.push(createGroup("Hidden by your filters", filtered, showAll));
    }
    body.replaceChildren(...groups);
}

function removeSummary(section: HTMLElement): void {
    for (const card of groupMembers.get(section) ?? []) card.classList.remove(GROUPED_CARD_CLASS);
    section.querySelectorAll<HTMLElement>("[aria-describedby]").forEach(removeTooltip);
    section.remove();
}

/** The page's main results list: the parent holding the most top-level cards. */
function findResultsList(): HTMLElement | undefined {
    const counts = new Map<HTMLElement, number>();
    for (const card of document.querySelectorAll(TOP_LEVEL_CARD_SELECTOR)) {
        const parent = card.parentElement;
        if (parent) counts.set(parent, (counts.get(parent) ?? 0) + 1);
    }
    let best: HTMLElement | undefined;
    for (const [parent, count] of counts) {
        if (!best || count > (counts.get(best) ?? 0)) best = parent;
    }
    return best;
}

/**
 * Collects every hidden listing on the page (properties, projects and featured carousels
 * alike, from every results list) into one collapsed summary at the end of the main results
 * list, so hidden listings never break up the results. Updated in place across re-renders.
 */
export function compactExcludedListingCards(): void {
    const items: ExcludedCard[] = [];
    for (const element of document.querySelectorAll<HTMLElement>(".edf-listing-card-excluded")) {
        // A hidden card inside another hidden card is already covered by the outer one.
        if (element.parentElement?.closest(".edf-listing-card-excluded")) continue;
        const item = getExcludedCard(element);
        if (item) items.push(item);
    }
    const hiddenCards = new Set(items.map(item => item.card));
    for (const card of document.querySelectorAll<HTMLElement>(`.${GROUPED_CARD_CLASS}`)) {
        if (!hiddenCards.has(card)) card.classList.remove(GROUPED_CARD_CLASS);
    }

    const [existing, ...extra] = document.querySelectorAll<HTMLElement>(GROUP_SELECTOR);
    extra.forEach(removeSummary);
    const host = findResultsList();
    if (items.length === 0 || !host) {
        if (existing) removeSummary(existing);
        return;
    }
    for (const card of hiddenCards) {
        if (!card.classList.contains(GROUPED_CARD_CLASS)) card.classList.add(GROUPED_CARD_CLASS);
    }
    const section = existing ?? createSummary();
    renderSummary(section, items);
    groupMembers.set(section, items.map(item => item.card));
    // Domain appends further results after it; keep the summary last.
    if (host.lastElementChild !== section) host.append(section);
}
