import { Logger } from "./logging";
import { MaybePromise } from "./types";

export interface PageContext {
    url: URL;
    signal: AbortSignal;
    logger: Logger;
}

export type PageMount = (context: PageContext) => MaybePromise<void>;

export interface Route {
    id: string;
    test: (url: URL) => boolean;
    load(): Promise<{default: PageMount}>;
}

export function observeUrlChanges(callback: (url: URL) => void, signal: AbortSignal): void {
    let previousHref = window.location.href;
    let scheduled = false;

    const check = (): void => {
        scheduled = false;

        if (signal.aborted || window.location.href === previousHref) return;

        previousHref = window.location.href;
        callback(new URL(previousHref));
    }

    const schedule = (): void => {
        if (signal.aborted || scheduled) return;

        scheduled = true;
        requestAnimationFrame(check);
    }

    window.addEventListener('popstate', schedule, { signal });
    window.addEventListener('hashchange', schedule, { signal });

    const observer = new MutationObserver(schedule);
    observer.observe(document.documentElement, {
        childList: true,
        subtree: true,
    });

    signal.addEventListener('abort', () => observer.disconnect(), { once: true });
}

export interface Router {
    run(url?: URL): Promise<void>;
    start(onError: (error: unknown) => void): void;
    stop(): void;
}

export function createRouter(
    routes: readonly Route[],
    logger: Logger,
): Router {
    const routeLoggers = new Map(
        routes.map(route => [
            route.id,
            logger.child(route.id),
        ]),
    );

    let lifecycleController: AbortController | undefined;
    let activeController: AbortController | undefined;
    let activeLogger: Logger | undefined;
    let activeKey: string | undefined;

    async function run(url = new URL(window.location.href)): Promise<void> {
        const route = routes.find(r => r.test(url));
        const nextKey = route ? `${route.id}:${url.pathname}` : undefined;

        if (nextKey === activeKey) return;

        activeLogger?.debug('Unmounting');
        activeController?.abort();

        activeController = undefined;
        activeKey = undefined;
        activeLogger = undefined;

        if (!route) {
            logger.info('No matching route found for URL', url.href);
            return;
        }

        activeLogger = routeLoggers.get(route.id);
        if (!activeLogger) {
            throw new Error(`Logger not found for route "${route.id}"`);
        }

        const controller = new AbortController();
        activeController = controller;
        activeKey = nextKey;

        activeLogger.info('Mounting', url.href);

        try {
            const { default: mount } = await route.load();

            if (controller.signal.aborted) return;

            await mount({ url, signal: controller.signal, logger: activeLogger });
            
            if (!controller.signal.aborted) activeLogger.info('Mounted');
        }
        catch (error) {
            if (controller.signal.aborted) return;

            activeLogger.error('Failed to mount', error);

            if (activeController === controller) {
                activeController = undefined;
                activeKey = undefined;
                activeLogger = undefined;
            }

            throw error;
        }
    }

    function start(onError: (error: unknown) => void): void {
        if (lifecycleController) return;

        lifecycleController = new AbortController();

        const runSafely = (url?: URL): void => {
            void run(url).catch(onError);
        }
        
        runSafely();
        observeUrlChanges(runSafely, lifecycleController.signal);
    }

    function stop(): void {
        lifecycleController?.abort();
        lifecycleController = undefined;

        activeController?.abort();
        activeController = undefined;
        activeKey = undefined;
    }

    return {
        run,
        start,
        stop,
    };
}