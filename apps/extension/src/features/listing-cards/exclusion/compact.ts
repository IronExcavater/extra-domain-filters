import type { ExclusionReason } from "../../../domain/matching";
import { replaceWithChevronIcon, replaceWithEyeOffIcon, replaceWithFilledBinIcon } from "../../../ui/icons";
import { removeTooltip } from "../../../ui/tooltip";
import { getBlacklistCardKind, getTitle, TOP_LEVEL_CARD_SELECTOR } from "../dom/card";
import { createHiddenRow, resolveExclusionAction, ROW_SELECTOR, setHiddenRowState } from "./row";

const GROUP_SELECTOR = '[data-testid="listing-card-exclusion-group"]';
const GROUPED_CARD_CLASS = "edf-exclusion-group-member";
const pinnedGroupUrls = new Set<string>();
let previousSignature = "";
let renderedGroups: HTMLElement[] = [];

type ActiveReason = Exclude<ExclusionReason, "none">;

interface ExcludedCard {
    card: HTMLElement;
    reason: ActiveReason;
    urls: string[];
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

function unwrapGroups(): void {
    renderedGroups = [];
    document.querySelectorAll<HTMLElement>(GROUP_SELECTOR).forEach(group => {
        group.querySelectorAll<HTMLElement>("[aria-describedby]").forEach(removeTooltip);
        group.remove();
    });
    document.querySelectorAll<HTMLElement>(`.${GROUPED_CARD_CLASS}`)
        .forEach(card => card.classList.remove(GROUPED_CARD_CLASS));
}

export const groupMembers = new WeakMap<HTMLElement, HTMLElement[]>();

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
    const row = createHiddenRow();
    row.classList.add("edf-exclusion-group-item");
    setHiddenRowState(row, {
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

function createGroup(group: ExcludedCard[]): HTMLElement {
    const section = document.createElement("section");
    const header = document.createElement("button");
    const icon = document.createElementNS("http://www.w3.org/2000/svg", "svg");
    const text = document.createElement("span");
    const title = document.createElement("span");
    const reason = document.createElement("span");
    const chevron = document.createElementNS("http://www.w3.org/2000/svg", "svg");
    const body = document.createElement("div");
    const urls = group.flatMap(item => item.urls);
    const expanded = urls.some(url => pinnedGroupUrls.has(url));
    const reasons = new Set(group.map(item => item.reason));

    section.className = "edf-exclusion-group";
    section.setAttribute("data-testid", "listing-card-exclusion-group");
    section.dataset.exclusionReason = reasons.size > 1 ? "mixed" : [...reasons][0];
    header.type = "button";
    header.className = "edf-exclusion-row edf-exclusion-group-header";
    header.setAttribute("data-testid", "listing-card-exclusion-group-toggle");
    header.setAttribute("aria-label", `${group.length} hidden listings`);
    icon.classList.add("edf-exclusion-row-icon");
    icon.setAttribute("aria-hidden", "true");
    icon.setAttribute("width", "18");
    icon.setAttribute("height", "18");
    (reasons.has("blacklisted") ? replaceWithFilledBinIcon : replaceWithEyeOffIcon)(icon);
    text.className = "edf-exclusion-row-text";
    title.className = "edf-exclusion-row-title";
    title.textContent = `${group.length} hidden listings`;
    reason.className = "edf-exclusion-row-reason";
    reason.textContent = [...reasons].map(value => value === "blacklisted" ? "Blacklisted" : "Filtered").join(" · ");
    text.append(title, reason);
    chevron.classList.add("edf-exclusion-group-chevron");
    chevron.setAttribute("aria-hidden", "true");
    chevron.setAttribute("width", "18");
    chevron.setAttribute("height", "18");
    replaceWithChevronIcon(chevron);
    header.append(icon, text, chevron);

    body.className = "edf-exclusion-group-body";
    body.setAttribute("data-testid", "listing-card-exclusion-group-body");
    body.append(...group.map(createGroupItem));
    section.append(header, body);

    header.addEventListener("click", event => {
        event.preventDefault();
        event.stopPropagation();
        const nextExpanded = section.dataset.expanded !== "true";
        for (const url of urls) {
            if (nextExpanded) pinnedGroupUrls.add(url);
            else pinnedGroupUrls.delete(url);
        }
        setExpanded(section, nextExpanded);
    });

    setExpanded(section, expanded, false);
    return section;
}

function groupRun(run: ExcludedCard[]): void {
    if (run.length < 2) return;
    for (const item of run) item.card.classList.add(GROUPED_CARD_CLASS);
    const section = createGroup(run);
    groupMembers.set(section, run.map(item => item.card));
    renderedGroups.push(section);
    run[0].card.before(section);
}

/** Ad slots and other empty siblings must not split a run of hidden listings. */
function isInvisibleSpacer(element: Element): boolean {
    return element instanceof HTMLElement &&
        !element.matches(TOP_LEVEL_CARD_SELECTOR) &&
        element.getBoundingClientRect().height < 1;
}

function getCompactionSignature(): string {
    // Only excluded-card runs affect grouping output, so collapse any number of consecutive
    // non-excluded cards into a single gap marker. Otherwise every card that infinite scroll
    // appends changes the signature and forces a full unwrap+rebuild for no reason.
    const parts: string[] = [];
    let inGap = false;

    for (const card of document.querySelectorAll<HTMLElement>(TOP_LEVEL_CARD_SELECTOR)) {
        const excluded = getExcludedCard(card);
        if (excluded) {
            parts.push(`${excluded.reason}:${excluded.urls.join(",")}`);
            inGap = false;
            continue;
        }

        if (!inGap) parts.push("gap");
        inGap = true;
    }

    return parts.join("|");
}

export function compactExcludedListingCards(): void {
    const signature = getCompactionSignature();
    // Domain re-renders the result list (hydration, pagination) and drops our group nodes and
    // member classes; an unchanged signature only means "nothing to do" while they survive.
    const intact = renderedGroups.every(group =>
        group.isConnected &&
        (groupMembers.get(group) ?? []).every(member => member.classList.contains(GROUPED_CARD_CLASS)));
    if (signature === previousSignature && intact) return;
    previousSignature = signature;

    unwrapGroups();

    const parents = new Set(
        [...document.querySelectorAll(TOP_LEVEL_CARD_SELECTOR)]
            .map(card => card.parentElement)
            .filter((parent): parent is HTMLElement => parent !== null),
    );

    for (const parent of parents) {
        let run: ExcludedCard[] = [];
        // oxlint-disable-next-line unicorn/no-useless-spread -- snapshot; parent.children is a live HTMLCollection
        for (const child of [...parent.children]) {
            const excluded = getExcludedCard(child);
            if (excluded) {
                run.push(excluded);
                continue;
            }

            if (isInvisibleSpacer(child)) continue;
            groupRun(run);
            run = [];
        }
        groupRun(run);
    }
}
