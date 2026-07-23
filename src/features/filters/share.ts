import { trackTelemetry } from "../../domain/telemetry/client";
import { onBodyMutations } from "../../shared/dom/bodyMutations";
import { markOwned } from "../../shared/dom/ownership";
import { writeClipboardText } from "../../shared/platform/clipboard";
import type { PageContext } from "../../shared/platform/router";
import { getSettings } from "../../shared/state/settings";
import {
    createButton,
    createSvgIcon,
} from "../../shared/ui/elements";
import { replaceWithShareIcon } from "../../shared/ui/icons";
import { showToast } from "../../shared/ui/toast";
import {
    bindPropertyAlertModal,
    updatePropertyAlertButtons,
} from "./alerts";
import { cloneActionButton } from "./clone/action";
import {
    createSharedFilterParams,
    syncSharedFilterParams,
} from "./searchParams";
import { createSearchShareUrl } from "./shareLink";

const SHARE_BUTTON_SELECTOR = '[data-testid="extra-domain-share"]';
const FILTER_ANCHOR_SELECTOR =
    "button#allfilters, button#mode, button#price, button#bedrooms, button#propertyTypes";
const BOOTSTRAP_DURATION_MS = 6000;
const RETRY_DELAY_MS = 250;
const boundSignals = new WeakSet<AbortSignal>();

function getPropertyAlertButton(): HTMLButtonElement | undefined {
    return document.querySelector<HTMLButtonElement>('button[name="property-alert"]') ??
        [...document.querySelectorAll<HTMLButtonElement>("button")]
            .find(button => /^(?:create|edit) alert$/i.test(button.textContent?.trim() ?? ""));
}

function getPlacement(): { host: HTMLElement; insertAfter: Element } | undefined {
    const alertButton = getPropertyAlertButton();
    if (alertButton?.parentElement) {
        return { host: alertButton.parentElement, insertAfter: alertButton };
    }

    const filter = document.querySelector<HTMLButtonElement>(FILTER_ANCHOR_SELECTOR);
    if (filter?.parentElement) {
        return { host: filter.parentElement, insertAfter: filter };
    }

    return undefined;
}

function createFallbackButton(): HTMLButtonElement {
    const button = createButton("", "edf-domain-button");
    const icon = document.createElement("span");
    const label = document.createElement("span");

    icon.append(createSvgIcon(replaceWithShareIcon));
    label.textContent = "Share";
    button.append(icon, label);

    return button;
}

function createShareButton(
    source: HTMLButtonElement | undefined,
    context: PageContext,
): HTMLButtonElement {
    const button = source
        ? cloneActionButton(source, {
            icon: replaceWithShareIcon,
            label: "Share",
            selected: false,
        })
        : createFallbackButton();
    button.name = "extra-domain-share";
    button.dataset.testid = "extra-domain-share";
    button.ariaLabel = "Copy filtered search link";
    button.title = "Share";
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
    const placement = getPlacement();
    if (!placement) return false;

    const { host, insertAfter } = placement;
    const existing = document.querySelector<HTMLButtonElement>(SHARE_BUTTON_SELECTOR);
    if (existing?.parentElement === host && existing.previousElementSibling === insertAfter) {
        return true;
    }

    host.querySelectorAll(SHARE_BUTTON_SELECTOR).forEach(button => button.remove());
    if (existing && existing.parentElement !== host) existing.remove();
    host.classList.add("edf-filter-actions");
    insertAfter.after(existing ?? createShareButton(getPropertyAlertButton(), context));
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
