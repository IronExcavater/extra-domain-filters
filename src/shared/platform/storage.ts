export function isExtensionContextUnavailable(error?: unknown): boolean {
    return chrome.runtime?.id === undefined ||
        (
            error instanceof Error &&
            /extension context invalidated|context invalidated|receiving end does not exist/i.test(error.message)
        );
}

export async function getFromStorage<T>(key: string): Promise<T | undefined> {
    try {
        const result = await chrome.storage.local.get(key);
        return result[key] as T | undefined;
    } catch (error) {
        if (isExtensionContextUnavailable(error)) return undefined;
        throw error;
    }
}

export async function mustGetFromStorage<T>(key: string): Promise<T> {
    let result: Record<string, unknown>;
    try {
        result = await chrome.storage.local.get(key);
    } catch (error) {
        if (isExtensionContextUnavailable(error)) {
            throw new Error("Extension context is no longer available. Reload the page after reloading the extension.");
        }
        throw error;
    }

    if (!(key in result)) throw new Error(`Required storage key ${key} not found`);
    return result[key] as T;
}

export async function setInStorage<T>(
    key: string,
    value: T | undefined,
): Promise<void> {
    try {
        await chrome.storage.local.set({ [key]: value });
    } catch (error) {
        if (!isExtensionContextUnavailable(error)) throw error;
    }
}

export async function removeInStorage(key: string): Promise<void> {
    try {
        await chrome.storage.local.remove(key);
    } catch (error) {
        if (!isExtensionContextUnavailable(error)) throw error;
    }
}

type StorageChangeHandler<T> = (
    value: T | undefined,
    previous: T | undefined,
) => void;

export function onStorageChange<T>(
    key: string,
    handler: StorageChangeHandler<T>,
    options?: { area?: chrome.storage.AreaName },
): () => void {
    const area = options?.area ?? "local";
    const listener = (
        changes: Record<string, chrome.storage.StorageChange>,
        areaName: string,
    ) => {
        if (areaName !== area) return;
        const change = changes[key];
        if (!change) return;
        handler(
            change.newValue as T | undefined,
            change.oldValue as T | undefined,
        );
    };

    if (isExtensionContextUnavailable()) return () => undefined;

    chrome.storage.onChanged.addListener(listener);
    return () => {
        try {
            chrome.storage.onChanged.removeListener(listener);
        } catch (error) {
            if (!isExtensionContextUnavailable(error)) throw error;
        }
    };
}
