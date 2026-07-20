import { type BlacklistEntry } from "../../domain/matching";
import { PageContext } from "../../shared/platform/router";
import { onStorageChange } from "../../shared/platform/storage";
import { injectListingCards } from "./bind";
import { bindAdRemoval } from "./cards/ads";
import { disposeCarouselControls, disposeDetachedCarouselControls } from "./cards/carousel";
import {
    PROJECT_CARD_SELECTOR,
    SHORTLIST_BUTTON_SELECTOR,
    TOPSPOT_CAROUSEL_SELECTOR,
} from "./dom/card";
import { REVEAL_CHANGE_EVENT } from "./exclusion/reveal";

export interface BindListingCardsOptions {
    showBlacklistedView?: boolean;
}

export function bindListingCards(
    context: PageContext,
    options: BindListingCardsOptions = {},
): void {
    const showBlacklistedView = options.showBlacklistedView ?? true;

    bindAdRemoval(context.signal);

    let scanFrame: number | undefined;
    let refreshInProgress = false;
    let refreshQueued = false;

    const refresh = async (): Promise<void> => {
        if (refreshInProgress) {
            refreshQueued = true;
            return;
        }

        refreshInProgress = true;

        try {
            await injectListingCards(context, showBlacklistedView);
        } finally {
            refreshInProgress = false;

            if (refreshQueued && !context.signal.aborted) {
                refreshQueued = false;
                schedule();
            }
        }
    };

    const schedule = (): void => {
        if (scanFrame !== undefined) return;

        scanFrame = requestAnimationFrame(() => {
            scanFrame = undefined;
            void refresh().catch(error =>
                context.logger.warn("Failed to refresh listing cards", error)
            );
        });
    };

    const cancelScheduledScan = (): void => {
        if (scanFrame === undefined) return;

        cancelAnimationFrame(scanFrame);
        scanFrame = undefined;
    };

    schedule();

    const isExtensionNode = (node: Node): boolean =>
        node instanceof Element && Boolean(
            node.closest('[class*="edf-"]') ??
            node.closest('[data-testid^="extra-domain-filters-"]'),
        );

    const listingSelector = [
        SHORTLIST_BUTTON_SELECTOR,
        PROJECT_CARD_SELECTOR,
        TOPSPOT_CAROUSEL_SELECTOR,
    ].join(",");

    const containsListing = (node: Node): boolean =>
        node instanceof Element && !isExtensionNode(node) && (
            node.matches(listingSelector) || node.querySelector(listingSelector) !== null
        );

    const observer = new MutationObserver(mutations => {
        disposeDetachedCarouselControls();

        const hasExternalAddition = mutations.some(mutation =>
            [...mutation.addedNodes].some(containsListing),
        );

        if (hasExternalAddition) schedule();
    });
    observer.observe(document.body, { childList: true, subtree: true });

    const unwatchBlacklist = onStorageChange<BlacklistEntry[]>("blacklist", schedule);
    const unwatchSettings = onStorageChange("settings", schedule);
    window.addEventListener(REVEAL_CHANGE_EVENT, schedule, { signal: context.signal });

    context.signal.addEventListener("abort", () => {
        observer.disconnect();
        cancelScheduledScan();
        disposeCarouselControls();
        unwatchBlacklist();
        unwatchSettings();
    }, { once: true });
}
