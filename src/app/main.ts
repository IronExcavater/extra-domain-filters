import "../shared/utils/string.extensions";
import "../shared/utils/math.extensions";

import { trackTelemetry } from "../domain/telemetry/client";
import { bindAccountMenuTrigger } from "../features/account";
import { enableNavigationChevronAnimation } from "../features/navigation";
import type { DomainPageResult } from "../shared/domain/action";
import {
    domainAlertBridge,
    isDomainAlertApplyMessage,
} from "../shared/domain/alerts";
import {
    findDomainSavedSearchAlertTrigger,
    findDomainSavedSearchEntry,
    isDomainSavedSearchRemoveMessage,
    removeDomainSavedSearch,
} from "../shared/domain/savedSearches";
import { createLifecycleScope } from "../shared/platform/lifecycle";
import { createLogger } from "../shared/platform/logging";
import { createRouter, observeUrlChanges } from "../shared/platform/router";
import { onStorageChange } from "../shared/platform/storage";
import { getSettings, type Settings } from "../shared/state/settings";
import { routes } from "./routes";

const logger = createLogger("Extra Domain Filters");
const router = createRouter(routes, logger);
const appScope = createLifecycleScope(undefined, "content-script");

function waitForDomainElement<T extends HTMLElement>(
    find: () => T | undefined,
    signal: AbortSignal,
): Promise<T> {
    const current = find();
    if (current) return Promise.resolve(current);
    return new Promise((resolve, reject) => {
        const observer = new MutationObserver(() => {
            const trigger = find();
            if (!trigger) return;
            cleanup();
            resolve(trigger);
        });
        const timer = window.setTimeout(() => {
            cleanup();
            reject(new Error("Domain's alert control is unavailable."));
        }, 10_000);
        const onAbort = (): void => {
            cleanup();
            reject(new DOMException("Cancelled", "AbortError"));
        };
        const cleanup = (): void => {
            observer.disconnect();
            window.clearTimeout(timer);
            signal.removeEventListener("abort", onAbort);
        };
        signal.addEventListener("abort", onAbort, { once: true });
        observer.observe(document.body, { childList: true, subtree: true });
    });
}

chrome.runtime.onMessage.addListener((message: unknown, _sender, sendResponse) => {
    if (!isDomainAlertApplyMessage(message) && !isDomainSavedSearchRemoveMessage(message)) return false;
    const controller = new AbortController();
    const timeout = window.setTimeout(() => controller.abort(), 15_000);
    const operation: Promise<DomainPageResult> = isDomainAlertApplyMessage(message)
        ? waitForDomainElement(() => message.domainId
            ? findDomainSavedSearchAlertTrigger(message.domainId)
            : document.querySelector<HTMLButtonElement>('button[name="property-alert"]') ?? undefined,
        controller.signal).then(trigger => domainAlertBridge.apply({
                frequency: message.frequency,
                signal: controller.signal,
                trigger,
            }))
        : waitForDomainElement(() => findDomainSavedSearchEntry(message.domainId), controller.signal)
            .then(async () => {
                await removeDomainSavedSearch(message.domainId);
                return { ok: true };
            });
    void operation
        .then(sendResponse)
        .catch(error => sendResponse({
            message: error instanceof Error ? error.message : "Could not update the Domain alert.",
            ok: false,
            reason: "unavailable",
        } satisfies DomainPageResult))
        .finally(() => window.clearTimeout(timeout));
    return true;
});

function syncStickyHeader(): void {
    const isHomePage = window.location.pathname === "/";

    if (isHomePage) delete document.documentElement.dataset.edfStickySite;
    else document.documentElement.dataset.edfStickySite = "true";
}

console.info("[Extra Domain Filters] Content script bootstrap loaded");
logger.info("Content script loaded");
void trackTelemetry({
    name: "extension_started",
    version: chrome.runtime.getManifest().version,
}).catch(error => logger.warn("Failed to track extension startup", error));

void (async () => {
    const settings = await getSettings();
    if (!settings.flags.enableExtension || appScope.disposed) return;

    router.start((error) => {
        logger.error("Unhandled routing error", error);
    });
    appScope.add(() => router.stop());
    enableNavigationChevronAnimation({
        get url() {
            return new URL(window.location.href);
        },
        signal: appScope.signal,
        scope: appScope,
        logger: logger.child("navigation"),
    });
    syncStickyHeader();
    observeUrlChanges(syncStickyHeader, appScope.signal);
    appScope.add(() => delete document.documentElement.dataset.edfStickySite);

    if (settings.flags.enableBlacklist) {
        const accountScope = appScope.child("account-menu");
        bindAccountMenuTrigger({
            get url() {
                return new URL(window.location.href);
            },
            signal: accountScope.signal,
            scope: accountScope,
            logger: logger.child("account"),
        });
    }
})().catch(error => logger.warn("Failed to start content script", error));

appScope.add(onStorageChange<Settings>("settings", (next, previous) => {
    if (!next || !previous || next.flags.enableExtension === previous.flags.enableExtension) return;
    document.documentElement.dataset.edfExtensionReload = "true";
    window.location.reload();
}));

window.addEventListener("pagehide", () => appScope.dispose(), { once: true });

