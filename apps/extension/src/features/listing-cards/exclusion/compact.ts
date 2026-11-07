import type { ExclusionReason } from "../../../domain/matching";
import { replaceWithChevronIcon, replaceWithEyeIcon, replaceWithUnbinIcon } from "../../../ui/icons";
import { removeTooltip, setTooltipText } from "../../../ui/tooltip";
import { getBlacklistCardKind, getTitle, PROJECT_MARKER_SELECTOR, TOP_LEVEL_CARD_SELECTOR } from "../dom/card";
import { resolveExclusionAction, ROW_SELECTOR } from "./row";

const GROUP_SELECTOR = '[data-testid="listing-card-exclusion-group"]';
const GROUPED_CARD_CLASS = "edf-exclusion-group-member";
const COLLAPSE_DELAY_MS = 180;
const pinnedGroupUrls = new Set<string>();
let previousSignature = "";

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
    // A top-level project bundle card reports as "standard" here (getBlacklistCardKind only
    // detects "project" when given its aggregate button, which isn't available at this call
    // site). Its own exclusion row already renders correct project-aware text via
    // updateProjectBlacklistSummary, so keep it out of the generic group — grouping it would
    // show it as a single expandable property instead of the project bundle it represents.
    if (element.querySelector(PROJECT_MARKER_SELECTOR)) return undefined;
    if (!element.classList.contains("edf-listing-card-excluded")) return undefined;

    const row = element.querySelector<HTMLElement>(ROW_SELECTOR);
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
    document.querySelectorAll<HTMLElement>(GROUP_SELECTOR).forEach(group => {
        group.querySelectorAll<HTMLElement>("[aria-describedby]").forEach(removeTooltip);
        group.remove();
    });
    document.querySelectorAll<HTMLElement>(`.${GROUPED_CARD_CLASS}`)
        .forEach(card => card.classList.remove(GROUPED_CARD_CLASS));
}

function setExpanded(group: HTMLElement, expanded: boolean): void {
    const body = group.querySelector<HTMLElement>('[data-testid="listing-card-exclusion-group-body"]');
    const button = group.querySelector<HTMLButtonElement>('[data-testid="listing-card-exclusion-group-toggle"]');
    if (!body || !button) return;

    group.dataset.expanded = String(expanded);
    body.style.maxHeight = expanded ? `${body.scrollHeight}px` : "0px";
    body.setAttribute("aria-hidden", String(!expanded));
    const label = expanded ? "Collapse hidden listings" : "Expand hidden listings";
    button.ariaLabel = label;
    button.setAttribute("aria-expanded", String(expanded));
    setTooltipText(button, label);
}

// A grouped item is always a flat row — icon, title (with its reason as inline context), and
// a single always-visible action button. Earlier this also had its own per-item expand/collapse
// panel nested inside the group's own expand/collapse, which produced an accordion-in-an-
// accordion that made no sense: there's nothing here worth hiding a second time.
function createGroupItem(item: ExcludedCard): HTMLElement {
    const row = document.createElement("div");
    const reasonIcon = document.createElementNS("http://www.w3.org/2000/svg", "svg");
    const summary = document.createElement("span");
    const title = document.createElement("span");
    const reason = document.createElement("span");
    const action = document.createElement("button");

    row.className = "edf-exclusion-group-item";
    summary.className = "edf-exclusion-group-item-text";
    title.textContent = item.urls.length > 1
        ? `${getTitle(item.card)} (${item.urls.length} properties)`
        : getTitle(item.card);
    reason.className = "edf-exclusion-group-item-reason";
    reason.textContent = item.reason === "blacklisted" ? "Blacklisted" : "Filtered by your preferences";
    summary.append(title, reason);

    reasonIcon.setAttribute("aria-hidden", "true");
    reasonIcon.setAttribute("width", "16");
    reasonIcon.setAttribute("height", "16");
    (item.reason === "blacklisted" ? replaceWithUnbinIcon : replaceWithEyeIcon)(reasonIcon);

    action.type = "button";
    action.className = "edf-exclusion-group-item-action";
    action.textContent = item.reason === "blacklisted" ? "Unblacklist" : "Show anyway";
    action.addEventListener("click", async event => {
        event.preventDefault();
        event.stopPropagation();
        await resolveExclusionAction(item.urls, item.reason);
    });

    row.append(reasonIcon, summary, action);
    return row;
}

function createGroup(group: ExcludedCard[]): HTMLElement {
    const section = document.createElement("section");
    const header = document.createElement("div");
    const text = document.createElement("span");
    const button = document.createElement("button");
    const icon = document.createElementNS("http://www.w3.org/2000/svg", "svg");
    const body = document.createElement("div");
    const urls = group.flatMap(item => item.urls);
    const expanded = urls.some(url => pinnedGroupUrls.has(url));
    let collapseTimer: number | undefined;

    section.className = "edf-exclusion-group";
    section.setAttribute("data-testid", "listing-card-exclusion-group");
    header.className = "edf-exclusion-group-header";
    text.className = "edf-exclusion-group-text";
    const reasons = new Set(group.map(item => item.reason));
    const reasonText = reasons.size > 1
        ? "Blacklisted and filtered"
        : reasons.has("blacklisted") ? "Blacklisted" : "Filtered";
    text.textContent = `${group.length} listings hidden · ${reasonText}`;

    button.type = "button";
    button.className = "edf-exclusion-row-button";
    button.setAttribute("data-testid", "listing-card-exclusion-group-toggle");
    icon.setAttribute("aria-hidden", "true");
    icon.setAttribute("width", "18");
    icon.setAttribute("height", "18");
    replaceWithChevronIcon(icon);
    button.append(icon);

    body.className = "edf-exclusion-group-body";
    body.setAttribute("data-testid", "listing-card-exclusion-group-body");
    body.append(...group.map(createGroupItem));
    header.append(text, button);
    section.append(header, body);

    button.addEventListener("click", event => {
        event.preventDefault();
        event.stopPropagation();
        const nextExpanded = section.dataset.expanded !== "true";
        for (const url of urls) {
            if (nextExpanded) pinnedGroupUrls.add(url);
            else pinnedGroupUrls.delete(url);
        }
        setExpanded(section, nextExpanded);
    });
    section.addEventListener("mouseenter", () => {
        if (collapseTimer !== undefined) window.clearTimeout(collapseTimer);
        setExpanded(section, true);
    });
    section.addEventListener("mouseleave", () => {
        collapseTimer = window.setTimeout(() => {
            if (!urls.some(url => pinnedGroupUrls.has(url))) setExpanded(section, false);
        }, COLLAPSE_DELAY_MS);
    });
    section.addEventListener("focusin", () => {
        if (collapseTimer !== undefined) window.clearTimeout(collapseTimer);
        setExpanded(section, true);
    });
    section.addEventListener("focusout", () => {
        collapseTimer = window.setTimeout(() => {
            if (!section.matches(":focus-within") && !urls.some(url => pinnedGroupUrls.has(url))) {
                setExpanded(section, false);
            }
        }, COLLAPSE_DELAY_MS);
    });

    section.dataset.expanded = String(expanded);
    if (!expanded) setExpanded(section, false);
    return section;
}

function groupRun(run: ExcludedCard[]): void {
    if (run.length < 2) return;
    for (const item of run) item.card.classList.add(GROUPED_CARD_CLASS);
    const section = createGroup(run);
    run[0].card.before(section);
    if (section.dataset.expanded === "true") {
        requestAnimationFrame(() => setExpanded(section, true));
    }
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
    if (signature === previousSignature) return;
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

            groupRun(run);
            run = [];
        }
        groupRun(run);
    }
}
