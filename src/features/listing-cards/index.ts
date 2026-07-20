import { type BlacklistEntry } from "../../domain/matching";
import { PageContext } from "../../shared/platform/router";
import { onStorageChange } from "../../shared/platform/storage";
import { injectListingCards } from "./bind";
import { bindAdRemoval } from "./cards/ads";
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

    const schedule = (): void => {
        if (scanFrame !== undefined) return;

        scanFrame = requestAnimationFrame(() => {
            scanFrame = undefined;
            void injectListingCards(context, showBlacklistedView).catch(error =>
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
        node instanceof Element && (
            [...node.classList].some(className => className.startsWith("edf-")) ||
            Boolean(node.closest('[data-testid^="extra-domain-filters-"]'))
        );

    const observer = new MutationObserver(mutations => {
        const hasExternalAddition = mutations.some(mutation =>
            [...mutation.addedNodes].some(node => !isExtensionNode(node)),
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
        unwatchBlacklist();
        unwatchSettings();
    }, { once: true });
}
