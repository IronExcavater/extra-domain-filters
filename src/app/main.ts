import '../shared/utils/string.extensions';
import '../shared/utils/math.extensions';

import { bindAccountMenuTrigger } from "../features/account";
import { createLogger } from "../shared/platform/logging";
import { createRouter } from "../shared/platform/router";
import { onStorageChange } from "../shared/platform/storage";
import { getSettings, type Settings } from "../shared/state/settings";
import { routes } from "./routes";

const logger = createLogger('Extra Domain Filters');
const router = createRouter(routes, logger);

console.info('[Extra Domain Filters] Content script bootstrap loaded');
logger.info('Content script loaded');

void (async () => {
    const settings = await getSettings();
    if (!settings.flags.enableExtension) return;

    router.start((error) => {
        logger.error('Unhandled routing error', error);
    });

    if (settings.flags.enableBlacklist) {
        bindAccountMenuTrigger({
            url: new URL(window.location.href),
            signal: new AbortController().signal,
            logger: logger.child('account'),
        });
    }
})();

onStorageChange<Settings>("settings", (next, previous) => {
    if (!next || !previous || next.flags.enableExtension === previous.flags.enableExtension) return;
    window.location.reload();
});

