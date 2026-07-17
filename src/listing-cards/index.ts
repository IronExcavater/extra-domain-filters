import { createClaimTracker } from "../core/claim";
import { PageContext } from "../core/router";
import { getSettings, type Settings } from "../core/settings";
import { getFromStorage, onStorageChange } from "../core/storage";
import { matchListing, type BlacklistEntry, type ExclusionReason } from "../matching";
import { bindAdRemoval } from "./ads";
import { isBundleActive } from "./bundle";
import { cloneBlacklistButton, insertBlacklistButton, updateButton, watchShortlistButtonClass } from "./button";
import {
    BLACKLIST_BUTTON_SELECTOR,
    getCard,
    getChildListingUrl,
    getListingSnapshot,
    getListingUrl,
    PROJECT_CARD_SELECTOR,
    PROJECT_MARKER_SELECTOR,
    SHORTLIST_BUTTON_SELECTOR,
} from "./card";
import { bindCarouselCard, updateCarouselCard } from "./carousel";
import { updateExclusionGroups } from "./exclusion-group";
import {
    applyExclusionState,
    ensureHideAgainAffordance,
    isRevealed,
    removeHideAgainAffordance,
    updateExclusionRow,
} from "./exclusion-row";
import { bindProjectCard, updateProjectBlacklistSummary } from "./project";
import { REVEAL_CHANGE_EVENT } from "./reveal";
import { toggleBlacklist } from "./toggle";

const TOPSPOT_CAROUSEL_SELECTOR = 'li[data-testid="topspot"]';
const CAROUSEL_CHILD_SELECTOR = '[data-testid="listing-card-child-listing"]';

const claimShortlistButton = createClaimTracker<HTMLButtonElement>();

// A "filtered" reason is suppressed back to "none" if the user has revealed it this session —
// applied here (not inside matching/index.ts) so matching stays a pure, DOM/session-free
// computation; only listing-cards' UI layer knows about the session-only reveal set.
function resolveExclusionReason(rawReason: ExclusionReason, url: string): ExclusionReason {
    return rawReason === "filtered" && isRevealed(url) ? "none" : rawReason;
}

// The carousel's own bulk-blacklist button's active/pressed look isn't driven by matching a
// single URL (it has none of its own — see bundle.ts) but by whether every current child is
// already blacklisted, via isBundleActive from Task 6.
function syncCarouselButton(carouselCard: HTMLElement, blacklist: BlacklistEntry[]): void {
    const button = carouselCard.querySelector<HTMLButtonElement>('.edf-carousel-blacklist-button');
    if (!button) return;

    const members = [...carouselCard.querySelectorAll<HTMLElement>(CAROUSEL_CHILD_SELECTOR)]
        .map(child => ({ url: getChildListingUrl(child) }))
        .filter((member): member is { url: string } => member.url !== undefined);

    updateButton(button, isBundleActive(members, blacklist));
}

function updateExistingCards(
    settings: Settings,
    blacklist: BlacklistEntry[],
    showBlacklistedView: boolean,
): void {
    // Keyed by project card so the per-project loop below can gate updateProjectBlacklistSummary
    // on whether the project itself (not any individual child) is excluded — see project.ts's
    // own comment on why that matters (it owns the shared exclusion row in that case, and must
    // not also delete or overwrite it out from under the generic handling below).
    const projectReasons = new Map<Element, ExclusionReason>();

    document.querySelectorAll<HTMLButtonElement>(BLACKLIST_BUTTON_SELECTOR)
        .forEach(button => {
            // A carousel's whole-card bulk button has no canonical URL of its own (it bundles
            // several unrelated child listings) — resolving one via getListingUrl's fallback
            // query would attribute a single arbitrary child's exclusion status to the entire
            // card, incorrectly collapsing/hiding every other unrelated child too. The carousel
            // loop below (updateCarouselCard + syncCarouselButton) owns this button entirely.
            if (button.dataset.blacklistScope === "carousel") return;

            const card = getCard(button);
            if (!card) return;

            const url = getListingUrl(button, card);
            if (!url) return;

            const rawMatch = matchListing(getListingSnapshot(card, url), settings, blacklist);
            const reason = resolveExclusionReason(rawMatch.exclusionReason, url);

            updateButton(button, reason === "blacklisted");

            if (button.dataset.blacklistScope === "project") {
                projectReasons.set(card, reason);
            }

            // Project children are hidden/restored in bulk via updateProjectBlacklistSummary
            // instead — leave this card's own visibility alone here.
            if (card.matches('[data-testid="listing-card-child-listing"]') &&
                card.closest(PROJECT_CARD_SELECTOR)?.querySelector(PROJECT_MARKER_SELECTOR)) {
                return;
            }

            if (showBlacklistedView) {
                applyExclusionState(card, button, reason);

                if (reason === "none" && rawMatch.exclusionReason === "filtered") {
                    ensureHideAgainAffordance(card, url);
                } else {
                    removeHideAgainAffordance(card);
                }

                if (reason !== "none") {
                    updateExclusionRow(card, url, reason);
                }
            }

            (card as HTMLElement).style.outline = reason === "none" && rawMatch.matchedPreferences.length > 0
                ? "3px solid #fc0"
                : "";
        });

    for (const projectCard of document.querySelectorAll<HTMLElement>(PROJECT_CARD_SELECTOR)) {
        const projectHeader = projectCard.querySelector<HTMLElement>(PROJECT_MARKER_SELECTOR);
        if (projectHeader) {
            const projectExcluded = (projectReasons.get(projectCard) ?? "none") !== "none";
            updateProjectBlacklistSummary(projectCard, projectHeader, blacklist, projectExcluded);
        }
    }

    for (const carouselCard of document.querySelectorAll<HTMLElement>(TOPSPOT_CAROUSEL_SELECTOR)) {
        updateCarouselCard(carouselCard, blacklist);
        syncCarouselButton(carouselCard, blacklist);
    }

    if (showBlacklistedView) updateExclusionGroups();
}

function bindBlacklistButton(
    shortlistButton: HTMLButtonElement,
    context: PageContext
): HTMLButtonElement | undefined {
    const card = getCard(shortlistButton);
    if (!card) return undefined;

    const url = getListingUrl(shortlistButton, card);
    if (!url) return undefined;

    const button = cloneBlacklistButton(shortlistButton);
    insertBlacklistButton(shortlistButton, button);
    watchShortlistButtonClass(shortlistButton, button, context);

    button.addEventListener("click", async event => {
        event.preventDefault();
        event.stopPropagation();
        await toggleBlacklist(card, url, context, shortlistButton, button);
    });

    return button;
}

export async function injectListingCards(
    context: PageContext,
    showBlacklistedView = true,
): Promise<void> {
    for (const projectCard of document.querySelectorAll<HTMLElement>(PROJECT_CARD_SELECTOR)) {
        bindProjectCard(projectCard, context);
    }

    for (const carouselCard of document.querySelectorAll<HTMLElement>(TOPSPOT_CAROUSEL_SELECTOR)) {
        bindCarouselCard(carouselCard, context);
    }

    for (const shortlistButton of document.querySelectorAll<HTMLButtonElement>(SHORTLIST_BUTTON_SELECTOR)) {
        if (!claimShortlistButton(shortlistButton)) continue;
        bindBlacklistButton(shortlistButton, context);
    }

    const [settings, blacklist = []] = await Promise.all([
        getSettings(),
        getFromStorage<BlacklistEntry[]>("blacklist"),
    ]);

    updateExistingCards(settings, blacklist, showBlacklistedView);
}

export interface BindListingCardsOptions {
    // The real /user/shortlist page has its own dedicated blacklist overlay (?blacklist=1) for
    // managing blacklisted entries, so the inline collapsed exclusion-row treatment there is
    // redundant and confusing — set to false to suppress it while still keeping the button
    // itself functional.
    showBlacklistedView?: boolean;
}

export function bindListingCards(
    context: PageContext,
    options: BindListingCardsOptions = {},
): void {
    const showBlacklistedView = options.showBlacklistedView ?? true;

    bindAdRemoval(context.signal);

    // Scoped to this mount, not module-level — see git history for why (a shared module-level
    // scanFrame previously broke card injection after mode/pagination changes).
    let scanFrame: number | undefined;

    const schedule = (): void => {
        if (scanFrame !== undefined) return;

        scanFrame = requestAnimationFrame(() => {
            scanFrame = undefined;
            void injectListingCards(context, showBlacklistedView).catch(error =>
                context.logger.warn("Failed to inject listing cards", error)
            );
        });
    };

    schedule();

    const observer = new MutationObserver(schedule);
    observer.observe(document.body, { childList: true, subtree: true });
    context.signal.addEventListener("abort", () => {
        observer.disconnect();
        if (scanFrame !== undefined) {
            cancelAnimationFrame(scanFrame);
            scanFrame = undefined;
        }
    }, { once: true });

    const refresh = (): void => {
        void injectListingCards(context, showBlacklistedView).catch(error =>
            context.logger.warn("Failed to refresh listing cards", error)
        );
    };
    const unwatchBlacklist = onStorageChange<BlacklistEntry[]>("blacklist", refresh);
    const unwatchSettings = onStorageChange("settings", refresh);
    window.addEventListener(REVEAL_CHANGE_EVENT, refresh, { signal: context.signal });

    context.signal.addEventListener("abort", () => {
        unwatchBlacklist();
        unwatchSettings();
    }, { once: true });
}
