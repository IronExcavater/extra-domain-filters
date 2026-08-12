const CONTEXT_ERROR_PATTERN = /extension context invalidated|context invalidated|receiving end does not exist/i;
const CONTEXT_UNAVAILABLE_MESSAGE = "Extension context is no longer available. Reload the page after reloading the extension.";

function isContextError(error: unknown): boolean {
    return error instanceof Error && CONTEXT_ERROR_PATTERN.test(error.message);
}

function mutableKeys(keys: string | readonly string[]): string | string[] {
    return typeof keys === "string" ? keys : [...keys];
}

export function isExtensionContextUnavailable(error?: unknown): boolean {
    return chrome.runtime?.id === undefined || isContextError(error);
}

export async function readLocalStorage(keys: string | readonly string[]): Promise<Record<string, unknown>> {
    try {
        return await chrome.storage.local.get(mutableKeys(keys));
    } catch (error) {
        if (isExtensionContextUnavailable(error)) return {};
        throw error;
    }
}

export async function writeLocalStorage(values: Record<string, unknown>): Promise<void> {
    try {
        await chrome.storage.local.set(values);
    } catch (error) {
        if (!isExtensionContextUnavailable(error)) throw error;
    }
}

export async function removeLocalStorage(keys: string | readonly string[]): Promise<void> {
    try {
        await chrome.storage.local.remove(mutableKeys(keys));
    } catch (error) {
        if (!isExtensionContextUnavailable(error)) throw error;
    }
}

export async function getFromStorage<T>(key: string): Promise<T | undefined> {
    return (await readLocalStorage(key))[key] as T | undefined;
}

export async function mustGetFromStorage<T>(key: string): Promise<T> {
    const result = await readLocalStorage(key);

    if (!(key in result)) {
        if (isExtensionContextUnavailable()) throw new Error(CONTEXT_UNAVAILABLE_MESSAGE);
        throw new Error(`Required storage key ${key} not found`);
    }
    return result[key] as T;
}

export async function setInStorage<T>(
    key: string,
    value: T | undefined,
): Promise<void> {
    await writeLocalStorage({ [key]: value });
}

export async function removeInStorage(key: string): Promise<void> {
    await removeLocalStorage(key);
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
