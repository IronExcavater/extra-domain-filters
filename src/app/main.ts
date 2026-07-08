import '../core/string.extensions';
import '../core/math.extensions';

import { bindAccountMenuTrigger } from "../account";
import { createLogger } from "../core/logging";
import { createRouter } from "../core/router";
import { routes } from "./routes";

const logger = createLogger('Extra Domain Filters');
const router = createRouter(routes, logger);

console.info('[Extra Domain Filters] Content script bootstrap loaded');
logger.info('Content script loaded');

router.start((error) => {
    logger.error('Unhandled routing error', error);
});

bindAccountMenuTrigger({
    url: new URL(window.location.href),
    signal: new AbortController().signal,
    logger: logger.child('account'),
});

