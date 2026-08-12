import { getCachedListings } from "../../domain/listings/cache";
import { requestListingEnrichment } from "../../domain/listings/enrichment";
import { matchListing, type BlacklistEntry, type ExclusionReason } from "../../domain/matching";
import { type Settings } from "../../state/settings";
import { setBlacklistActionState } from "./actions/blacklistAction";
import {
    getCarouselMembers,
    updateCarouselCard,
    type CarouselListingDecision,
} from "./cards/carousel";
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
import { compactExcludedListingCards } from "./exclusion/compact";
import { isRevealed } from "./exclusion/reveal";
import {
    applyExclusionState,
    ensureHideAgainAffordance,
    removeHideAgainAffordance,
    updateExclusionRow,
} from "./exclusion/row";
import { updatePreferenceTags } from "./render/preferenceTags";

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

export async function updateListingCards(
    settings: Settings,
    blacklist: BlacklistEntry[],
    showBlacklistedView: boolean,
): Promise<void> {
    const wholeProjectReasons = new Map<Element, ExclusionReason>();
    const carouselCards = [...document.querySelectorAll<HTMLElement>(TOPSPOT_CAROUSEL_SELECTOR)];
    const carouselListings = carouselCards.flatMap(carouselCard =>
        getCarouselMembers(carouselCard).map(member => ({ carouselCard, ...member })),
    );
    const cards = [...document.querySelectorAll<HTMLButtonElement>(BLACKLIST_BUTTON_SELECTOR)]
        .flatMap(button => {
            if (button.dataset.blacklistScope === "carousel") return [];
            const card = getCard(button);
            if (!card) return [];
            const url = getListingUrl(button, card);
            if (!url) return [];

            return [{ button, card, snapshot: getListingSnapshot(card, url, { includeThumbnail: false }), url }];
        });
    const cachedListings = await getCachedListings([
        ...cards.map(({ url }) => url),
        ...carouselListings.map(({ url }) => url),
    ]);

    if (settings.filters.enrichListingDetails) {
        requestListingEnrichment([
            ...cards.map(({ snapshot }) => snapshot),
            ...carouselListings.map(({ snapshot }) => snapshot),
        ]);
    }

    const getBestSnapshot = (snapshot: CarouselListingDecision["snapshot"], url: string) => {
        const cached = cachedListings.get(url.replace(/\/$/, ""));
        return cached && cached.text.length > snapshot.text.length
            ? { ...snapshot, ...cached, text: cached.text }
            : snapshot;
    };

    cards.forEach(({ button, card, snapshot, url }) => {
            const listing = getBestSnapshot(snapshot, url);

            const match = matchListing(
                listing,
                settings,
                blacklist,
                { isFilteredListingRevealed: isRevealed },
            );
            const reason = match.exclusionReason;

            setBlacklistActionState(button, {
                active: reason === "blacklisted",
                label: button.dataset.blacklistScope === "project" ? "Blacklist project" : undefined,
            });

            if (button.dataset.blacklistScope === "project") {
                wholeProjectReasons.set(card, reason);
            }

            if (isProjectChild(card) || button.dataset.blacklistScope === "carousel-child") return;

            if (showBlacklistedView) {
                applyExclusionState(card, button, reason);

                if (reason === "none" && match.filterMatched) {
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
                reason === "none" ? match.matchedPreferences : [],
            );
        });

    for (const projectCard of document.querySelectorAll<HTMLElement>(PROJECT_CARD_SELECTOR)) {
        const projectHeader = projectCard.querySelector<HTMLElement>(PROJECT_MARKER_SELECTOR);
        if (!projectHeader) continue;

        const projectExcluded = (wholeProjectReasons.get(projectCard) ?? "none") !== "none";
        updateProjectBlacklistSummary(projectCard, projectHeader, blacklist, projectExcluded);
    }

    const carouselDecisions = new Map<HTMLElement, CarouselListingDecision[]>();
    for (const { carouselCard, snapshot, url } of carouselListings) {
        const listing = getBestSnapshot(snapshot, url);
        const decision: CarouselListingDecision = {
            exclusionReason: matchListing(
                listing,
                settings,
                blacklist,
                { isFilteredListingRevealed: isRevealed },
            ).exclusionReason,
            snapshot: listing,
            url,
        };
        const entries = carouselDecisions.get(carouselCard) ?? [];
        entries.push(decision);
        carouselDecisions.set(carouselCard, entries);
    }

    for (const carouselCard of carouselCards) {
        updateCarouselCard(carouselCard, carouselDecisions.get(carouselCard) ?? []);
    }

    if (showBlacklistedView) compactExcludedListingCards();

}
