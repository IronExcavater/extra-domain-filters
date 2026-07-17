import type { ExclusionReason } from "../../../domain/matching";
import { replaceWithEyeIcon, replaceWithUnbinIcon } from "../../../shared/ui/icons";
import { TOP_LEVEL_CARD_SELECTOR } from "../dom/card";
import { resolveExclusionAction } from "./row";

const HIDDEN_CLASS = "edf-exclusion-merged-hidden";
const LEAD_CLASS = "edf-exclusion-merged-lead";
const ROW_SELECTOR = '[data-testid="listing-card-exclusion-row"]';

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

function setMergedRow(group: ExcludedCard[]): void {
    const [lead] = group;
    const row = lead.card.querySelector<HTMLElement>(ROW_SELECTOR);
    const text = row?.querySelector<HTMLElement>('[data-testid="listing-card-exclusion-row-text"]');
    const button = row?.querySelector<HTMLButtonElement>('[data-testid="listing-card-exclusion-restore"]');
    const icon = button?.querySelector("svg");
    const reasons = new Set(group.map(item => item.reason));
    const reason = reasons.size === 1 ? lead.reason : "filtered";

    if (text) {
        text.textContent = reasons.size === 1 && lead.reason === "blacklisted"
            ? `${group.length} listings blacklisted`
            : `${group.length} listings hidden`;
    }

    if (icon) (reason === "blacklisted" ? replaceWithUnbinIcon : replaceWithEyeIcon)(icon);

    if (button) {
        button.lastChild!.textContent = "Restore all";
        button.ariaLabel = "Restore all";
        button.onclick = async event => {
            event.preventDefault();
            event.stopPropagation();

            const blacklistedUrls = group
                .filter(item => item.reason === "blacklisted")
                .flatMap(item => item.urls);
            const filteredUrls = group
                .filter(item => item.reason === "filtered")
                .flatMap(item => item.urls);

            if (blacklistedUrls.length > 0) {
                await resolveExclusionAction(blacklistedUrls, "blacklisted");
            }
            if (filteredUrls.length > 0) {
                await resolveExclusionAction(filteredUrls, "filtered");
            }
        };
    }
}

function compactRun(run: ExcludedCard[]): void {
    if (run.length < 2) return;

    run[0].card.classList.add(LEAD_CLASS);
    for (const item of run.slice(1)) {
        item.card.classList.add(HIDDEN_CLASS);
    }
    setMergedRow(run);
}

export function compactExcludedListingCards(): void {
    document.querySelectorAll<HTMLElement>(`.${HIDDEN_CLASS}, .${LEAD_CLASS}`)
        .forEach(card => card.classList.remove(HIDDEN_CLASS, LEAD_CLASS));

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

            compactRun(run);
            run = [];
        }

        compactRun(run);
    }
}
