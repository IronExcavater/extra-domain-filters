import type { ExclusionReason } from "../../../domain/matching";
import { replaceWithChevronIcon } from "../../../shared/ui/icons";
import { TOP_LEVEL_CARD_SELECTOR } from "../dom/card";

const HIDDEN_CLASS = "edf-exclusion-merged-hidden";
const LEAD_CLASS = "edf-exclusion-merged-lead";
const ROW_SELECTOR = '[data-testid="listing-card-exclusion-row"]';
const ICON_STATE_ATTRIBUTE = "data-edf-icon-state";
const expandedGroups = new Set<string>();

type ActiveReason = Exclude<ExclusionReason, "none">;

interface ExcludedCard {
    card: HTMLElement;
    reason: ActiveReason;
    urls: string[];
}

function getExcludedCard(element: Element): ExcludedCard | undefined {
    if (!(element instanceof HTMLElement)) return undefined;
    if (!element.matches(TOP_LEVEL_CARD_SELECTOR)) return undefined;
    if (!element.classList.contains("edf-listing-card-excluded")) return undefined;

    const row = element.querySelector<HTMLElement>(ROW_SELECTOR);
    const reason = row?.dataset.exclusionReason as ActiveReason | undefined;
    if (reason !== "blacklisted" && reason !== "filtered") return undefined;

    const rawUrls = row?.dataset.exclusionUrls;
    if (!rawUrls) return undefined;

    try {
        const urls = JSON.parse(rawUrls);
        return Array.isArray(urls) && urls.every(url => typeof url === "string")
            ? { card: element, reason, urls }
            : undefined;
    } catch {
        return undefined;
    }
}

function getGroupKey(group: ExcludedCard[]): string {
    return group
        .flatMap(item => item.urls)
        .sort()
        .join("\n");
}

function setMergedRow(group: ExcludedCard[]): void {
    const [lead] = group;
    const row = lead.card.querySelector<HTMLElement>(ROW_SELECTOR);
    const text = row?.querySelector<HTMLElement>('[data-testid="listing-card-exclusion-row-text"]');
    const button = row?.querySelector<HTMLButtonElement>('[data-testid="listing-card-exclusion-restore"]');
    const icon = button?.querySelector("svg");
    const reasons = new Set(group.map(item => item.reason));
    const key = getGroupKey(group);
    const expanded = expandedGroups.has(key);

    if (text) {
        const label = reasons.size === 1 && lead.reason === "blacklisted"
            ? "Multiple blacklisted listings"
            : "Multiple hidden listings";

        if (text.textContent !== label) text.textContent = label;
    }

    if (button) {
        if (icon && icon.getAttribute(ICON_STATE_ATTRIBUTE) !== "expand") {
            replaceWithChevronIcon(icon);
            icon.setAttribute(ICON_STATE_ATTRIBUTE, "expand");
        }
        const ariaLabel = expanded ? "Collapse hidden listings" : "Expand hidden listings";
        button.dataset.expanded = String(expanded);
        if (button.ariaLabel !== ariaLabel) button.ariaLabel = ariaLabel;
        if (button.title !== ariaLabel) button.title = ariaLabel;
        button.onclick = event => {
            event.preventDefault();
            event.stopPropagation();

            if (expandedGroups.has(key)) expandedGroups.delete(key);
            else expandedGroups.add(key);
            compactExcludedListingCards();
        };
    }
}

function collectCompactRun(
    run: ExcludedCard[],
    leadCards: Set<HTMLElement>,
    hiddenCards: Set<HTMLElement>,
): void {
    if (run.length < 2) return;

    leadCards.add(run[0].card);
    if (!expandedGroups.has(getGroupKey(run))) {
        for (const item of run.slice(1)) {
            hiddenCards.add(item.card);
        }
    }
    setMergedRow(run);
}

export function compactExcludedListingCards(): void {
    const parents = new Set(
        [...document.querySelectorAll(TOP_LEVEL_CARD_SELECTOR)]
            .map(card => card.parentElement)
            .filter((parent): parent is HTMLElement => parent !== null),
    );
    const leadCards = new Set<HTMLElement>();
    const hiddenCards = new Set<HTMLElement>();

    for (const parent of parents) {
        let run: ExcludedCard[] = [];

        for (const child of [...parent.children]) {
            const excluded = getExcludedCard(child);
            if (excluded) {
                run.push(excluded);
                continue;
            }

            collectCompactRun(run, leadCards, hiddenCards);
            run = [];
        }

        collectCompactRun(run, leadCards, hiddenCards);
    }

    document.querySelectorAll<HTMLElement>(TOP_LEVEL_CARD_SELECTOR).forEach(card => {
        card.classList.toggle(LEAD_CLASS, leadCards.has(card));
        card.classList.toggle(HIDDEN_CLASS, hiddenCards.has(card));
    });
}
