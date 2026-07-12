import { createClaimTracker } from "../core/claim";
import { PageContext } from "../core/router";
import { getSettings, type Settings } from "../core/settings";
import { getFromStorage, onStorageChange } from "../core/storage";
import { matchListing, type BlacklistEntry } from "../matching";
import { bindAdRemoval } from "./ads";
import { cloneBlacklistButton, insertBlacklistButton, updateButton, watchShortlistButtonClass } from "./button";
import {
    BLACKLIST_BUTTON_SELECTOR,
    getBlacklistCardKind,
    getCard,
    getListingSnapshot,
    getListingUrl,
    PROJECT_CARD_SELECTOR,
    PROJECT_MARKER_SELECTOR,
    SHORTLIST_BUTTON_SELECTOR,
} from "./card";
import { bindProjectCard, updateProjectBlacklistSummary } from "./project";
import { applyBlacklistCardState, getSummary, updateBlacklistSummaryText } from "./summary";
import { toggleBlacklist } from "./toggle";

const claimShortlistButton = createClaimTracker<HTMLButtonElement>();

function hasActiveExclusion(settings: Settings, blacklist: BlacklistEntry[]): boolean {
    return (
        blacklist.some(entry => !entry.removedAt) ||
        settings.filters.excludeKeywords.length > 0 ||
        settings.filters.strataMaxDollars < 2000
    );
}

function updateExistingCards(
    settings: Settings,
    blacklist: BlacklistEntry[],
    showBlacklistedView: boolean,
): void {
    document.querySelectorAll<HTMLButtonElement>(BLACKLIST_BUTTON_SELECTOR)
        .forEach(button => {
            const card = getCard(button);
            if (!card) return;

            const url = getListingUrl(button, card);
            if (!url) return;

            const match = matchListing(getListingSnapshot(card, url), settings, blacklist);
            const kind = getBlacklistCardKind(card, button);

            updateButton(button, match.blacklisted);

            // Project children are hidden/restored in bulk via updateProjectBlacklistSummary
            // instead — leave this card's own visibility alone here.
            if (kind === "project-child") return;

            if (showBlacklistedView) {
                updateBlacklistSummaryText(card);
                applyBlacklistCardState(card, button, match.blacklisted);
            }

            (card as HTMLElement).hidden =
                hasActiveExclusion(settings, blacklist) && match.excluded && !match.blacklisted;
            (card as HTMLElement).style.outline = !match.blacklisted && match.matchedPreferences.length > 0
                ? "3px solid #fc0"
                : "";
        });

    for (const projectCard of document.querySelectorAll<HTMLElement>(PROJECT_CARD_SELECTOR)) {
        const projectHeader = projectCard.querySelector<HTMLElement>(PROJECT_MARKER_SELECTOR);
        if (projectHeader) updateProjectBlacklistSummary(projectCard, projectHeader, blacklist);
    }
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

    getSummary(card)
        .querySelector<HTMLButtonElement>('[data-testid="listing-card-blacklist-restore"]')
        ?.addEventListener("click", event => {
            event.preventDefault();
            event.stopPropagation();
            void toggleBlacklist(card, url, context, shortlistButton, button);
        });

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
    // managing blacklisted entries, so the inline collapsed "Blacklisted: ..." treatment there
    // is redundant and confusing — set to false to suppress it while still keeping the button
    // itself functional.
    showBlacklistedView?: boolean;
}

export function bindListingCards(
    context: PageContext,
    options: BindListingCardsOptions = {},
): void {
    const showBlacklistedView = options.showBlacklistedView ?? true;

    bindAdRemoval(context.signal);

    // Scoped to this mount, not module-level: a previous version shared one scanFrame variable
    // across every page mount, and its abort handler cancelled the pending frame without ever
    // resetting the variable back to undefined. The next mount's schedule() would then see a
    // stale non-undefined value and silently never queue another scan for the rest of the
    // content script's lifetime — exactly what broke card injection after a mode switch or
    // pagination change remounted the page (both change the pathname, which aborts this mount).
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

    context.signal.addEventListener("abort", () => {
        unwatchBlacklist();
        unwatchSettings();
    }, { once: true });
}
