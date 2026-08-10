import { trackTelemetry } from "../../domain/telemetry/client";
import { onBodyMutations } from "../../shared/dom/bodyMutations";
import { markOwned } from "../../shared/dom/ownership";
import {
    findDomainFilterActionPlacement,
} from "../../shared/domain/filters";
import { writeClipboardText } from "../../shared/platform/clipboard";
import type { PageContext } from "../../shared/platform/router";
import { getSettings } from "../../shared/state/settings";
import { replaceWithShareIcon } from "../../shared/ui/icons";
import { showToast } from "../../shared/ui/toast";
import {
    bindPropertyAlertModal,
    updatePropertyAlertButtons,
} from "./alerts";
import { createFilterAction } from "./controls";
import {
    createSharedFilterParams,
    syncSharedFilterParams,
} from "./searchParams";
import { createSearchShareUrl } from "./shareLink";

const SHARE_BUTTON_SELECTOR = '[data-testid="extra-domain-share"]';
const BOOTSTRAP_DURATION_MS = 6000;
const RETRY_DELAY_MS = 250;
const boundSignals = new WeakSet<AbortSignal>();

function createShareButton(
    context: PageContext,
): HTMLButtonElement {
    const button = createFilterAction({
        ariaLabel: "Copy filtered search link",
        icon: replaceWithShareIcon,
        label: "Share",
        signal: context.signal,
    });
    button.name = "extra-domain-share";
    button.dataset.testid = "extra-domain-share";
    button.ariaLabel = "Copy filtered search link";
    button.classList.add("edf-search-share-button");
    button.addEventListener("click", async event => {
        event.preventDefault();
        const settings = await getSettings();
        syncSharedFilterParams(settings);
        const shareUrl = await createSearchShareUrl(
            window.location.href,
            createSharedFilterParams(settings),
        );

        await writeClipboardText(shareUrl);
        void trackTelemetry({ name: "feature_used", feature: "filter_share" });
        showToast("Search link copied");
        button.blur();
    }, { signal: context.signal });

    return markOwned(button, "share-filter-action");
}

function injectShareButton(context: PageContext): boolean {
    const placement = findDomainFilterActionPlacement();
    if (!placement) return false;

    const { host, insertAfter } = placement;
    const existing = document.querySelector<HTMLButtonElement>(SHARE_BUTTON_SELECTOR);
    const existingContainer = existing?.closest<HTMLElement>(".edf-filter-actions");
    if (existingContainer?.parentElement === host && existingContainer.previousElementSibling === insertAfter) {
        return true;
    }

    existingContainer?.remove();
    const container = markOwned(document.createElement("span"), "filter-actions");
    container.className = "edf-filter-actions";
    container.append(existing ?? createShareButton(context));
    insertAfter.after(container);
    void updatePropertyAlertButtons().catch(error =>
        context.logger.warn("Failed to update property alert state", error)
    );

    return true;
}

export async function bindSearchShareButton(context: PageContext): Promise<void> {
    bindPropertyAlertModal(context);
    if (boundSignals.has(context.signal)) return;
    boundSignals.add(context.signal);

    let timer: number | undefined;
    let retryTimer: number | undefined;
    const retryUntil = performance.now() + BOOTSTRAP_DURATION_MS;
    const reconcile = (): void => {
        if (timer !== undefined) window.clearTimeout(timer);
        timer = window.setTimeout(() => {
            timer = undefined;
            if (!injectShareButton(context) &&
                performance.now() < retryUntil &&
                !context.signal.aborted) {
                retryTimer = window.setTimeout(reconcile, RETRY_DELAY_MS);
            }
        }, 0);
    };

    onBodyMutations(reconcile, context.signal);
    context.scope.add(() => {
        if (timer !== undefined) window.clearTimeout(timer);
        if (retryTimer !== undefined) window.clearTimeout(retryTimer);
    });
    reconcile();
}
