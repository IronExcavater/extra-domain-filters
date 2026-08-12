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
        root = document.body,
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
