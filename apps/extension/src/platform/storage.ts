import { storage, type StorageArea, type StorageItemKey } from "wxt/utils/storage";

const CONTEXT_ERROR_PATTERN = /extension context invalidated|context invalidated|receiving end does not exist/i;
const CONTEXT_UNAVAILABLE_MESSAGE = "Extension context is no longer available. Reload the page after reloading the extension.";

function isContextError(error: unknown): boolean {
    return error instanceof Error && CONTEXT_ERROR_PATTERN.test(error.message);
}

function mutableKeys(keys: string | readonly string[]): string[] {
    return typeof keys === "string" ? [keys] : [...keys];
}

function toStorageKey(key: string, area: StorageArea = "local"): StorageItemKey {
    return `${area}:${key}`;
}

function fromStorageKey(key: StorageItemKey): string {
    return key.slice(key.indexOf(":") + 1);
}

export function isExtensionContextUnavailable(error?: unknown): boolean {
    return chrome.runtime?.id === undefined || isContextError(error);
}

export async function readLocalStorage(keys: string | readonly string[]): Promise<Record<string, unknown>> {
    try {
        const items = await storage.getItems(mutableKeys(keys).map(key => toStorageKey(key)));
        const result: Record<string, unknown> = {};
        for (const { key, value } of items) {
            if (value !== null) result[fromStorageKey(key)] = value;
        }
        return result;
    } catch (error) {
        if (isExtensionContextUnavailable(error)) return {};
        throw error;
    }
}

export async function writeLocalStorage(values: Record<string, unknown>): Promise<void> {
    try {
        await storage.setItems(Object.entries(values).map(([key, value]) => ({ key: toStorageKey(key), value })));
    } catch (error) {
        if (!isExtensionContextUnavailable(error)) throw error;
    }
}

export async function removeLocalStorage(keys: string | readonly string[]): Promise<void> {
    try {
        await storage.removeItems(mutableKeys(keys).map(key => toStorageKey(key)));
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
    options?: { area?: StorageArea },
): () => void {
    if (isExtensionContextUnavailable()) return () => undefined;

    const unwatch = storage.watch<T>(toStorageKey(key, options?.area), (newValue, oldValue) => {
        handler(newValue ?? undefined, oldValue ?? undefined);
    });

    return () => {
        try {
            unwatch();
        } catch (error) {
            if (!isExtensionContextUnavailable(error)) throw error;
        }
    };
}
