import '../shared/utils/string.extensions';
import '../shared/utils/math.extensions';

import { bindAccountMenuTrigger } from "../features/account";
import { createLifecycleScope } from "../shared/platform/lifecycle";
import { createLogger } from "../shared/platform/logging";
import { createRouter } from "../shared/platform/router";
import { onStorageChange } from "../shared/platform/storage";
import { getSettings, type Settings } from "../shared/state/settings";
import { routes } from "./routes";

const logger = createLogger('Extra Domain Filters');
const router = createRouter(routes, logger);
const appScope = createLifecycleScope(undefined, "content-script");

console.info('[Extra Domain Filters] Content script bootstrap loaded');
logger.info('Content script loaded');

void (async () => {
    const settings = await getSettings();
    if (!settings.flags.enableExtension) return;

    router.start((error) => {
        logger.error('Unhandled routing error', error);
    });
    appScope.add(() => router.stop());

    if (settings.flags.enableBlacklist) {
        const accountScope = appScope.child("account-menu");
        bindAccountMenuTrigger({
            get url() {
                return new URL(window.location.href);
            },
            signal: accountScope.signal,
            scope: accountScope,
            logger: logger.child('account'),
        });
    }
})();

appScope.add(onStorageChange<Settings>("settings", (next, previous) => {
    if (!next || !previous || next.flags.enableExtension === previous.flags.enableExtension) return;
    window.location.reload();
}));

window.addEventListener("pagehide", () => appScope.dispose(), { once: true });

