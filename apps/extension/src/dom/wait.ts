export interface WaitForElementOptions {
    observe?: MutationObserverInit;
    root?: Node;
    timeoutMessage?: string;
    timeoutMs?: number;
}

export function waitForElement<T>(
    find: () => T | undefined,
    signal: AbortSignal,
    options: WaitForElementOptions = {},
): Promise<T> {
    const {
        observe = { childList: true, subtree: true },
        // Content scripts run at document_start, when document.body may still
        // be null. The Document is always observable and includes the body as
        // soon as the parser creates it.
        root = document,
        timeoutMessage,
        timeoutMs,
    } = options;

    if (signal.aborted) {
        return Promise.reject(new DOMException("Unmounted", "AbortError"));
    }

    const existing = find();
    if (existing) return Promise.resolve(existing);

    return new Promise((resolve, reject) => {
        let settled = false;
        const cleanup = (): void => {
            observer.disconnect();
            if (timeout !== undefined) window.clearTimeout(timeout);
            signal.removeEventListener("abort", onAbort);
        };
        const onAbort = (): void => {
            if (settled) return;
            settled = true;
            cleanup();
            reject(new DOMException("Unmounted", "AbortError"));
        };
        const observer = new MutationObserver(() => {
            const element = find();
            if (!element || settled) return;
            settled = true;
            cleanup();
            resolve(element);
        });
        const timeout = timeoutMs !== undefined
            ? window.setTimeout(() => {
                if (settled) return;
                settled = true;
                cleanup();
                reject(timeoutMessage ? new Error(timeoutMessage) : new DOMException("Timed out", "TimeoutError"));
            }, timeoutMs)
            : undefined;
        observer.observe(root, observe);
        signal.addEventListener("abort", onAbort, { once: true });
    });
}

/**
 * Resolves once Domain's Next.js app has hydrated: Next mounts its route announcer from an
 * effect after the first commit. Restructuring server-rendered markup before then makes
 * React adopt our nodes as its own (it hydrated our toolbar as its tab row and hid its sort).
 * Pages without the announcer resolve after the timeout.
 */
export async function waitForHydration(signal: AbortSignal): Promise<void> {
    try {
        await waitForElement(() => document.querySelector("next-route-announcer") ?? undefined, signal, {
            timeoutMs: 8000,
        });
    } catch (error) {
        if (!(error instanceof DOMException && error.name === "TimeoutError")) throw error;
    }
}

/**
 * Lets the page render a frame. Hidden tabs (the background tab the popup opens to apply a
 * change on Domain) never run animation frames, so a short timer settles it there instead.
 */
export function nextFrame(): Promise<void> {
    return new Promise(resolve => {
        const timer = window.setTimeout(resolve, 50);
        requestAnimationFrame(() => {
            window.clearTimeout(timer);
            resolve();
        });
    });
}
