import { type BlacklistEntry } from "../../domain/matching";
import { isOwnedNode } from "../../shared/dom/ownership";
import { createFrameReconciler } from "../../shared/dom/reconcile";
import { PageContext } from "../../shared/platform/router";
import { onStorageChange } from "../../shared/platform/storage";
import { getSettings } from "../../shared/state/settings";
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
    const scope = context.scope.child("listing-cards");
    const featureContext: PageContext = {
        get url() {
            return context.url;
        },
        logger: context.logger,
        scope,
        signal: scope.signal,
    };

    void getSettings().then(settings => {
        if (settings.flags.enableAdBlocking && !scope.disposed) bindAdRemoval(scope.signal);
    });

    const reconciler = createFrameReconciler(
        scope,
        () => injectListingCards(featureContext, showBlacklistedView),
        error => context.logger.warn("Failed to refresh listing cards", error),
    );
    reconciler.schedule();

    const isExtensionNode = (node: Node): boolean =>
        isOwnedNode(node) || node instanceof Element && Boolean(
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
        if (mutations.some(mutation => mutation.removedNodes.length > 0)) {
            disposeDetachedCarouselControls();
        }

        const hasExternalAddition = mutations.some(mutation =>
            [...mutation.addedNodes].some(containsListing),
        );

        if (hasExternalAddition) reconciler.schedule();
    });
    observer.observe(document.body, { childList: true, subtree: true });
    scope.add(() => observer.disconnect());

    scope.add(onStorageChange<BlacklistEntry[]>("blacklist", reconciler.schedule));
    scope.add(onStorageChange("settings", reconciler.schedule));
    scope.add(disposeCarouselControls);
    window.addEventListener(REVEAL_CHANGE_EVENT, reconciler.schedule, { signal: scope.signal });
}
