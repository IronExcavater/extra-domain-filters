import { matchListing, type BlacklistEntry, type ExclusionReason } from "../../domain/matching";
import { type Settings } from "../../shared/state/settings";
import { updateCarouselCard } from "./cards/carousel";
import { updateProjectBlacklistSummary } from "./cards/project";
import { updateButton } from "./clone/blacklistButton";
import {
    BLACKLIST_BUTTON_SELECTOR,
    CAROUSEL_CHILD_SELECTOR,
    getCard,
    getChildListingUrl,
    getListingSnapshot,
    getListingUrl,
    PROJECT_CARD_SELECTOR,
    PROJECT_MARKER_SELECTOR,
    TOP_LEVEL_CARD_SELECTOR,
    TOPSPOT_CAROUSEL_SELECTOR,
} from "./dom/card";
import { compactExcludedListingCards } from "./exclusion/compact";
import {
    applyExclusionState,
    ensureHideAgainAffordance,
    isRevealed,
    removeHideAgainAffordance,
    updateExclusionRow,
} from "./exclusion/row";
import { updatePreferenceTags } from "./render/preferenceTags";

function resolveVisibleReason(rawReason: ExclusionReason, url: string): ExclusionReason {
    return rawReason === "filtered" && isRevealed(url) ? "none" : rawReason;
}

function isProjectChild(card: Element): boolean {
    return card.matches(CAROUSEL_CHILD_SELECTOR) &&
        card.closest(PROJECT_CARD_SELECTOR)?.querySelector(PROJECT_MARKER_SELECTOR) !== null;
}

function getProjectActionUrls(card: Element, projectUrl: string): string[] {
    return [
        projectUrl,
        ...[...card.querySelectorAll<HTMLElement>(CAROUSEL_CHILD_SELECTOR)]
            .map(getChildListingUrl)
            .filter((url): url is string => url !== undefined),
    ];
}

export function updateListingCards(
    settings: Settings,
    blacklist: BlacklistEntry[],
    showBlacklistedView: boolean,
): void {
    const layoutBefore = new Map(
        [...document.querySelectorAll<HTMLElement>(TOP_LEVEL_CARD_SELECTOR)]
            .map(card => [card, card.getBoundingClientRect()] as const),
    );
    const wholeProjectReasons = new Map<Element, ExclusionReason>();

    document.querySelectorAll<HTMLButtonElement>(BLACKLIST_BUTTON_SELECTOR)
        .forEach(button => {
            if (button.dataset.blacklistScope === "carousel") return;

            const card = getCard(button);
            if (!card) return;

            const url = getListingUrl(button, card);
            if (!url) return;

            const rawMatch = matchListing(
                getListingSnapshot(card, url, { includeThumbnail: false }),
                settings,
                blacklist,
            );
            const reason = resolveVisibleReason(rawMatch.exclusionReason, url);

            updateButton(
                button,
                reason === "blacklisted",
                button.dataset.blacklistScope === "project" ? "Blacklist project" : undefined,
            );

            if (button.dataset.blacklistScope === "project") {
                wholeProjectReasons.set(card, reason);
            }

            if (isProjectChild(card) || button.dataset.blacklistScope === "carousel-child") return;

            if (showBlacklistedView) {
                applyExclusionState(card, button, reason);

                if (reason === "none" && rawMatch.exclusionReason === "filtered") {
                    ensureHideAgainAffordance(card, url);
                } else {
                    removeHideAgainAffordance(card);
                }

                if (reason !== "none") {
                    updateExclusionRow(
                        card,
                        button.dataset.blacklistScope === "project"
                            ? getProjectActionUrls(card, url)
                            : url,
                        reason,
                    );
                }
            }

            updatePreferenceTags(
                card,
                settings.display.showPreferenceTags && reason === "none" ? rawMatch.matchedPreferences : [],
            );
        });

    for (const projectCard of document.querySelectorAll<HTMLElement>(PROJECT_CARD_SELECTOR)) {
        const projectHeader = projectCard.querySelector<HTMLElement>(PROJECT_MARKER_SELECTOR);
        if (!projectHeader) continue;

        const projectExcluded = (wholeProjectReasons.get(projectCard) ?? "none") !== "none";
        updateProjectBlacklistSummary(projectCard, projectHeader, blacklist, projectExcluded);
    }

    for (const carouselCard of document.querySelectorAll<HTMLElement>(TOPSPOT_CAROUSEL_SELECTOR)) {
        updateCarouselCard(carouselCard, blacklist);
    }

    if (showBlacklistedView) compactExcludedListingCards();

    for (const [card, before] of layoutBefore) {
        const after = card.getBoundingClientRect();
        const x = before.left - after.left;
        const y = before.top - after.top;
        if (x === 0 && y === 0) continue;

        card.animate(
            [
                { opacity: 0.72, transform: `translate(${x}px, ${y}px) scale(0.985)` },
                { opacity: 1, transform: "translate(0, 0) scale(1)" },
            ],
            { duration: 300, easing: "cubic-bezier(0.2, 0, 0, 1)" },
        );
    }
}
