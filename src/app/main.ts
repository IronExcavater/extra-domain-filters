import "../shared/utils/string.extensions";
import "../shared/utils/math.extensions";

import { trackTelemetry } from "../domain/telemetry/client";
import { bindAccountMenuTrigger } from "../features/account";
import { enableNavigationChevronAnimation } from "../features/navigation";
import { createLifecycleScope } from "../shared/platform/lifecycle";
import { createLogger } from "../shared/platform/logging";
import { createRouter, observeUrlChanges } from "../shared/platform/router";
import { onStorageChange } from "../shared/platform/storage";
import { getSettings, type Settings } from "../shared/state/settings";
import { routes } from "./routes";

const logger = createLogger("Extra Domain Filters");
const router = createRouter(routes, logger);
const appScope = createLifecycleScope(undefined, "content-script");

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
    window.location.reload();
}));

window.addEventListener("pagehide", () => appScope.dispose(), { once: true });

