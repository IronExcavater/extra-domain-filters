import { matchListing, type BlacklistEntry, type ExclusionReason } from "../../domain/matching";
import { type Settings } from "../../shared/state/settings";
import { isBundleSelected } from "./blacklist/bundle";
import { updateButton } from "./blacklist/button";
import { updateCarouselCard } from "./cards/carousel";
import { updateProjectBlacklistSummary } from "./cards/project";
import {
    BLACKLIST_BUTTON_SELECTOR,
    CAROUSEL_CHILD_SELECTOR,
    getCard,
    getChildListingUrl,
    getListingSnapshot,
    getListingUrl,
    PROJECT_CARD_SELECTOR,
    PROJECT_MARKER_SELECTOR,
    TOPSPOT_CAROUSEL_SELECTOR,
} from "./dom/card";
import {
    applyExclusionState,
    ensureHideAgainAffordance,
    isRevealed,
    removeHideAgainAffordance,
    updateExclusionRow,
} from "./exclusion/row";

function resolveVisibleReason(rawReason: ExclusionReason, url: string): ExclusionReason {
    return rawReason === "filtered" && isRevealed(url) ? "none" : rawReason;
}

function syncCarouselBulkButtonState(carouselCard: HTMLElement, blacklist: BlacklistEntry[]): void {
    const button = carouselCard.querySelector<HTMLButtonElement>('.edf-carousel-blacklist-button');
    if (!button) return;

    const members = [...carouselCard.querySelectorAll<HTMLElement>(CAROUSEL_CHILD_SELECTOR)]
        .map(child => ({ url: getChildListingUrl(child) }))
        .filter((member): member is { url: string } => member.url !== undefined);

    updateButton(button, isBundleSelected(members, blacklist), "Blacklist featured properties");
}

function isProjectChild(card: Element): boolean {
    return card.matches(CAROUSEL_CHILD_SELECTOR) &&
        card.closest(PROJECT_CARD_SELECTOR)?.querySelector(PROJECT_MARKER_SELECTOR) !== null;
}

function markPreferenceMatch(card: Element, active: boolean): void {
    (card as HTMLElement).style.outline = active ? "3px solid #fc0" : "";
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

            updateButton(button, reason === "blacklisted");

            if (button.dataset.blacklistScope === "project") {
                wholeProjectReasons.set(card, reason);
            }

            if (isProjectChild(card)) return;

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

            markPreferenceMatch(card, reason === "none" && rawMatch.matchedPreferences.length > 0);
        });

    for (const projectCard of document.querySelectorAll<HTMLElement>(PROJECT_CARD_SELECTOR)) {
        const projectHeader = projectCard.querySelector<HTMLElement>(PROJECT_MARKER_SELECTOR);
        if (!projectHeader) continue;

        const projectExcluded = (wholeProjectReasons.get(projectCard) ?? "none") !== "none";
        updateProjectBlacklistSummary(projectCard, projectHeader, blacklist, projectExcluded);
    }

    for (const carouselCard of document.querySelectorAll<HTMLElement>(TOPSPOT_CAROUSEL_SELECTOR)) {
        updateCarouselCard(carouselCard, blacklist);
        syncCarouselBulkButtonState(carouselCard, blacklist);
    }

}
