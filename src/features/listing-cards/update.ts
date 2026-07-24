import { getCachedListings } from "../../domain/listings/cache";
import { requestListingEnrichment } from "../../domain/listings/enrichment";
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

const layoutAnimations = new WeakMap<HTMLElement, Animation>();

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

export async function updateListingCards(
    settings: Settings,
    blacklist: BlacklistEntry[],
    showBlacklistedView: boolean,
): Promise<void> {
    const layoutBefore = new Map(
        [...document.querySelectorAll<HTMLElement>(TOP_LEVEL_CARD_SELECTOR)]
            .map(card => [card, card.getBoundingClientRect()] as const),
    );
    const wholeProjectReasons = new Map<Element, ExclusionReason>();
    const cards = [...document.querySelectorAll<HTMLButtonElement>(BLACKLIST_BUTTON_SELECTOR)]
        .flatMap(button => {
            if (button.dataset.blacklistScope === "carousel") return [];
            const card = getCard(button);
            if (!card) return [];
            const url = getListingUrl(button, card);
            if (!url) return [];

            return [{ button, card, snapshot: getListingSnapshot(card, url, { includeThumbnail: false }), url }];
        });
    const cachedListings = await getCachedListings(cards.map(({ url }) => url));

    if (settings.filters.enrichListingDetails) {
        requestListingEnrichment(cards.map(({ snapshot }) => snapshot));
    }

    cards.forEach(({ button, card, snapshot, url }) => {
            const cached = cachedListings.get(url.replace(/\/$/, ""));
            const listing = cached && cached.text.length > snapshot.text.length
                ? { ...snapshot, ...cached, text: cached.text }
                : snapshot;

            const rawMatch = matchListing(
                listing,
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
                reason === "none" ? rawMatch.matchedPreferences : [],
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
        const expandedBy = after.height - before.height;
        if (x === 0 && y === 0 && expandedBy === 0) continue;

        layoutAnimations.get(card)?.cancel();
        const animation = card.animate(
            [
                {
                    clipPath: expandedBy > 0
                        ? `inset(0 0 ${expandedBy}px 0 round ${getComputedStyle(card).borderRadius})`
                        : "inset(0)",
                    opacity: 0.72,
                    transform: `translate(${x}px, ${y}px) scale(0.985)`,
                },
                {
                    clipPath: "inset(0)",
                    opacity: 1,
                    transform: "translate(0, 0) scale(1)",
                },
            ],
            { duration: 280, easing: "cubic-bezier(0.2, 0, 0, 1)" },
        );
        layoutAnimations.set(card, animation);
        animation.addEventListener("finish", () => {
            if (layoutAnimations.get(card) === animation) layoutAnimations.delete(card);
        }, { once: true });
        animation.addEventListener("cancel", () => {
            if (layoutAnimations.get(card) === animation) layoutAnimations.delete(card);
        }, { once: true });
    }
}
