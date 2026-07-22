import type { Disposer } from "./lifecycle";
import { onStorageChange } from "./storage";

export interface StorageRepositoryOptions<T> {
    key: string;
    version: number;
    createDefault: () => T;
    normalize: (value: unknown) => T;
    migrate?: (value: unknown, fromVersion: number) => T;
}

export interface StorageRepository<T> {
    get(): Promise<T>;
    set(value: T): Promise<void>;
    update(updater: (current: T) => T | Promise<T>): Promise<T>;
    clear(): Promise<void>;
    observe(handler: (value: T, previous: T) => void): Disposer;
}

const VERSION_SUFFIX = ":schema-version";

function clone<T>(value: T): T {
    return structuredClone(value);
}

export function createStorageRepository<T>(
    options: StorageRepositoryOptions<T>,
): StorageRepository<T> {
    const versionKey = `${options.key}${VERSION_SUFFIX}`;
    let updateQueue = Promise.resolve();

    const read = async (): Promise<T> => {
        const stored = await chrome.storage.local.get([options.key, versionKey]);
        if (!(options.key in stored)) return options.createDefault();

        const fromVersion = typeof stored[versionKey] === "number"
            ? stored[versionKey]
            : 0;
        const value = fromVersion === options.version
            ? options.normalize(stored[options.key])
            : (options.migrate ?? options.normalize)(stored[options.key], fromVersion);

        if (fromVersion !== options.version) {
            await chrome.storage.local.set({
                [options.key]: clone(value),
                [versionKey]: options.version,
            });
        }

        return value;
    };

    const write = async (value: T): Promise<void> => {
        await chrome.storage.local.set({
            [options.key]: clone(options.normalize(value)),
            [versionKey]: options.version,
        });
    };

    const enqueue = <R>(operation: () => Promise<R>): Promise<R> => {
        const result = updateQueue.then(operation);
        updateQueue = result.then(() => undefined, () => undefined);
        return result;
    };

    const update = (updater: (current: T) => T | Promise<T>): Promise<T> =>
        enqueue(async () => {
            const next = options.normalize(await updater(await read()));
            await write(next);
            return next;
        });

    return {
        get: read,
        set: value => enqueue(() => write(value)),
        update,
        async clear() {
            await enqueue(() => chrome.storage.local.remove([options.key, versionKey]));
        },
        observe(handler) {
            return onStorageChange<unknown>(options.key, (value, previous) => {
                handler(
                    value === undefined ? options.createDefault() : options.normalize(value),
                    previous === undefined ? options.createDefault() : options.normalize(previous),
                );
            });
        },
    };
}
