import '../shared/string.extensions';
import '../shared/math.extensions';

import { bindAccountMenuTrigger } from "../features/account";
import { createLogger } from "../shared/logging";
import { createRouter } from "../shared/router";
import { routes } from "./routes";

const logger = createLogger('Extra Domain Filters');
const router = createRouter(routes, logger);

logger.info('Content script loaded');

router.start((error) => {
    logger.error('Unhandled routing error', error);
});

bindAccountMenuTrigger({
    url: new URL(window.location.href),
    signal: new AbortController().signal,
    logger: logger.child('account'),
});

