export function getFromStorage<T>(key: string): Promise<T | undefined> {
    const read = (res: Record<string, unknown>): T | undefined =>
        res[key] as T | undefined;

    return new Promise((resolve) => {
        chrome.storage.local.get(key, (r) => {
            resolve(read(r));
        });
    });
}

export function mustGetFromStorage<T>(key: string): Promise<T> {
    const read = (res: Record<string, unknown>): T => {
        if (!(key in res))
            throw new Error(`Required storage key ${key} not found`);
        return res[key] as T;
    };

    return new Promise((resolve, reject) => {
        chrome.storage.local.get(key, (r) => {
            try {
                resolve(read(r));
            } catch (err) {
                reject(err);
            }
        });
    });
}

export async function setInStorage<T>(
    key: string,
    value: T | undefined
): Promise<void> {
    await chrome.storage.local.set({ [key]: value });
}

export async function removeInStorage(key: string): Promise<void> {
    await chrome.storage.local.remove(key);
}

type StorageChangeHandler<T> = (
    value: T | undefined,
    previous: T | undefined
) => void;

export function onStorageChange<T>(
    key: string,
    handler: StorageChangeHandler<T>,
    options?: { area?: chrome.storage.AreaName }
) {
    const area = options?.area ?? 'local';
    const listener = (
        changes: Record<string, chrome.storage.StorageChange>,
        areaName: string
    ) => {
        if (areaName !== area) return;
        const change = changes[key];
        if (!change) return;
        handler(
            change.newValue as T | undefined,
            change.oldValue as T | undefined
        );
    };

    chrome.storage.onChanged.addListener(listener);
    return () => chrome.storage.onChanged.removeListener(listener);
}
