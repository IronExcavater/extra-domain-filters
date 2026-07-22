export function waitForElement<T extends Element>(
    find: () => T | undefined,
    signal: AbortSignal,
    root: Node = document.body,
): Promise<T> {
    if (signal.aborted) {
        return Promise.reject(new DOMException("Unmounted", "AbortError"));
    }

    const existing = find();
    if (existing) return Promise.resolve(existing);

    return new Promise((resolve, reject) => {
        let settled = false;
        const cleanup = (): void => {
            observer.disconnect();
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
        observer.observe(root, { childList: true, subtree: true });
        signal.addEventListener("abort", onAbort, { once: true });
    });
}
