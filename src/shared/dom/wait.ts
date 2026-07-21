export function waitForElement<T extends Element>(
    find: () => T | undefined,
    signal: AbortSignal,
    root: Node = document.body,
): Promise<T> {
    const existing = find();
    if (existing) return Promise.resolve(existing);

    return new Promise((resolve, reject) => {
        const observer = new MutationObserver(() => {
            const element = find();
            if (!element) return;
            observer.disconnect();
            resolve(element);
        });
        observer.observe(root, { childList: true, subtree: true });
        signal.addEventListener("abort", () => {
            observer.disconnect();
            reject(new DOMException("Unmounted", "AbortError"));
        }, { once: true });
    });
}
