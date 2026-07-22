import { MaybePromise } from "../utils/types";
import { createLifecycleScope, type Disposer, type LifecycleScope } from "./lifecycle";
import { Logger } from "./logging";

export interface PageContext {
    url: URL;
    signal: AbortSignal;
    scope: LifecycleScope;
    logger: Logger;
}

export type PageMount = (context: PageContext) => MaybePromise<void | Disposer>;

const URL_CHANGE_EVENT = "extra-domain-filters:url-change";
const HISTORY_PATCH_KEY = "__extraDomainFiltersHistoryPatched";

export interface Route {
    id: string;
    test: (url: URL) => boolean;
    load(): Promise<{default: PageMount}>;
}

function installHistoryObserver(): void {
    const patchedHistory = history as History & Record<string, unknown>;
    if (patchedHistory[HISTORY_PATCH_KEY]) return;
    patchedHistory[HISTORY_PATCH_KEY] = true;

    for (const method of ["pushState", "replaceState"] as const) {
        const original = history[method];

        history[method] = function (...args: Parameters<History[typeof method]>): void {
            original.apply(history, args);
            window.dispatchEvent(new Event(URL_CHANGE_EVENT));
        };
    }
}

export function observeUrlChanges(callback: (url: URL) => void, signal: AbortSignal): void {
    let previousHref = window.location.href;
    let scheduled = false;

    installHistoryObserver();

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
    window.addEventListener(URL_CHANGE_EVENT, schedule, { signal });
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

    let lifecycleScope: LifecycleScope | undefined;
    let activeScope: LifecycleScope | undefined;
    let activeLogger: Logger | undefined;
    let activeKey: string | undefined;

    async function run(url = new URL(window.location.href)): Promise<void> {
        const route = routes.find(r => r.test(url));
        const nextKey = route ? `${route.id}:${url.pathname}` : undefined;

        if (nextKey === activeKey) return;

        activeLogger?.debug('Unmounting');
        activeScope?.dispose();

        activeScope = undefined;
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

        const scope = lifecycleScope?.child(route.id) ?? createLifecycleScope(undefined, route.id);
        activeScope = scope;
        activeKey = nextKey;

        activeLogger.info('Mounting', url.href);

        try {
            const { default: mount } = await route.load();

            if (scope.disposed) return;

            const disposer = await mount({
                get url() {
                    return new URL(window.location.href);
                },
                signal: scope.signal,
                scope,
                logger: activeLogger,
            });
            if (disposer) scope.add(disposer);
            
            if (!scope.disposed) activeLogger.info('Mounted');
        }
        catch (error) {
            if (scope.disposed) return;

            activeLogger.error('Failed to mount', error);

            if (activeScope === scope) {
                scope.dispose();
                activeScope = undefined;
                activeKey = undefined;
                activeLogger = undefined;
            }

            throw error;
        }
    }

    function start(onError: (error: unknown) => void): void {
        if (lifecycleScope) return;

        lifecycleScope = createLifecycleScope(undefined, "router");

        const runSafely = (url?: URL): void => {
            void run(url).catch(onError);
        }
        
        runSafely();
        observeUrlChanges(runSafely, lifecycleScope.signal);
    }

    function stop(): void {
        activeScope?.dispose();
        activeScope = undefined;
        activeLogger = undefined;
        activeKey = undefined;

        lifecycleScope?.dispose();
        lifecycleScope = undefined;
    }

    return {
        run,
        start,
        stop,
    };
}
