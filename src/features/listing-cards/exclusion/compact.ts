import type { ExclusionReason } from "../../../domain/matching";
import { replaceWithChevronIcon } from "../../../shared/ui/icons";
import { getBlacklistCardKind, TOP_LEVEL_CARD_SELECTOR } from "../dom/card";

const GROUP_SELECTOR = '[data-testid="listing-card-exclusion-group"]';
const ROW_SELECTOR = '[data-testid="listing-card-exclusion-row"]';
const expandedUrls = new Set<string>();
let previousSignature = "";

type ActiveReason = Exclude<ExclusionReason, "none">;

interface ExcludedCard {
    card: HTMLElement;
    reason: ActiveReason;
    urls: string[];
}

function getExcludedCard(element: Element): ExcludedCard | undefined {
    if (!(element instanceof HTMLElement) || !element.matches(TOP_LEVEL_CARD_SELECTOR)) return undefined;
    if (getBlacklistCardKind(element) === "project-child" || getBlacklistCardKind(element) === "carousel-child") {
        return undefined;
    }
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
    for (const group of document.querySelectorAll<HTMLElement>(GROUP_SELECTOR)) {
        const body = group.querySelector<HTMLElement>('[data-testid="listing-card-exclusion-group-body"]');
        if (!body) {
            group.remove();
            continue;
        }
        group.replaceWith(...body.children);
    }
}

function setExpanded(group: HTMLElement, expanded: boolean): void {
    const body = group.querySelector<HTMLElement>('[data-testid="listing-card-exclusion-group-body"]');
    const button = group.querySelector<HTMLButtonElement>('[data-testid="listing-card-exclusion-group-toggle"]');
    if (!body || !button) return;

    group.dataset.expanded = String(expanded);
    body.style.maxHeight = expanded ? `${body.scrollHeight}px` : "0px";
    const label = expanded ? "Collapse blacklisted listings" : "Expand blacklisted listings";
    button.ariaLabel = label;
    button.title = label;
}

function createGroup(group: ExcludedCard[]): HTMLElement {
    const section = document.createElement("section");
    const header = document.createElement("div");
    const text = document.createElement("span");
    const button = document.createElement("button");
    const icon = document.createElementNS("http://www.w3.org/2000/svg", "svg");
    const body = document.createElement("div");
    const urls = group.flatMap(item => item.urls);
    const expanded = urls.some(url => expandedUrls.has(url));

    section.className = "edf-exclusion-group";
    section.setAttribute("data-testid", "listing-card-exclusion-group");
    header.className = "edf-exclusion-group-header";
    text.className = "edf-exclusion-group-text";
    text.textContent = `${group.length} listings`;

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
    body.append(...group.map(item => item.card));
    header.append(text, button);
    section.append(header, body);

    button.addEventListener("click", event => {
        event.preventDefault();
        event.stopPropagation();
        const nextExpanded = section.dataset.expanded !== "true";
        for (const url of urls) {
            if (nextExpanded) expandedUrls.add(url);
            else expandedUrls.delete(url);
        }
        setExpanded(section, nextExpanded);
    });

    section.dataset.expanded = String(expanded);
    return section;
}

function groupRun(run: ExcludedCard[]): void {
    if (run.length < 2) return;
    const marker = document.createComment("");
    run[0].card.before(marker);
    const section = createGroup(run);
    marker.replaceWith(section);
    if (section.dataset.expanded === "true") {
        requestAnimationFrame(() => setExpanded(section, true));
    }
}

function getCompactionSignature(): string {
    return [...document.querySelectorAll<HTMLElement>(TOP_LEVEL_CARD_SELECTOR)]
        .map(card => {
            const excluded = getExcludedCard(card);
            if (!excluded) return `visible:${card.dataset.listingId ?? ""}`;
            return `${excluded.reason}:${excluded.urls.join(",")}`;
        })
        .join("|");
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
