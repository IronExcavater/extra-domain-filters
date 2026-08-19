import { createStorageRepository } from "../../platform/repository";
import { isPlainObject } from "../../utils/types";
import type { LogicalClock } from "./merge";

interface DeviceState {
    counter: number;
    id: string;
    createdAt: number;
    lastTimestamp: number;
}

const deviceRepository = createStorageRepository<DeviceState | undefined>({
    key: "syncDevice",
    version: 1,
    createDefault: () => undefined,
    normalize: value => {
        if (!isPlainObject(value)) return undefined;
        return typeof value.id === "string" && typeof value.createdAt === "number"
            ? {
                id: value.id,
                createdAt: value.createdAt,
                counter: typeof value.counter === "number" ? value.counter : 0,
                lastTimestamp: typeof value.lastTimestamp === "number"
                    ? value.lastTimestamp
                    : value.createdAt,
            }
            : undefined;
    },
});

let clockQueue = Promise.resolve();
let deviceIdPromise: Promise<string> | undefined;

export function getDeviceId(): Promise<string> {
    deviceIdPromise ??= deviceRepository.update(current => {
        if (current) return current;
        const now = Date.now();
        return {
            counter: 0,
            id: crypto.randomUUID(),
            createdAt: now,
            lastTimestamp: now,
        };
    }).then(state => state?.id ?? Promise.reject(new Error("Could not create a device ID")));
    return deviceIdPromise;
}

export function nextLogicalClock(): Promise<LogicalClock> {
    const operation = clockQueue.then(async () => {
        let result: LogicalClock | undefined;

        await deviceRepository.update(current => {
            const now = Date.now();
            const state = current ?? {
                counter: 0,
                createdAt: now,
                id: crypto.randomUUID(),
                lastTimestamp: now,
            };
            const timestamp = Math.max(now, state.lastTimestamp);
            const counter = timestamp === state.lastTimestamp ? state.counter + 1 : 0;
            result = { counter, deviceId: state.id, timestamp };
            return { ...state, counter, lastTimestamp: timestamp };
        });

        if (!result) throw new Error("Could not create a synchronization clock");
        return result;
    });
    clockQueue = operation.then(() => undefined, () => undefined);
    return operation;
}

export function observeLogicalClocks(clocks: readonly LogicalClock[]): Promise<void> {
    if (clocks.length === 0) return Promise.resolve();
    const operation = clockQueue.then(async () => {
        await deviceRepository.update(current => {
            if (!current) return current;
            const latest = clocks.reduce((first, second) => {
                if (second.timestamp !== first.timestamp) {
                    return second.timestamp > first.timestamp ? second : first;
                }
                return second.counter > first.counter ? second : first;
            });
            if (latest.timestamp < current.lastTimestamp) return current;
            if (latest.timestamp === current.lastTimestamp && latest.counter <= current.counter) {
                return current;
            }
            return {
                ...current,
                counter: latest.timestamp === current.lastTimestamp
                    ? Math.max(current.counter, latest.counter)
                    : latest.counter,
                lastTimestamp: latest.timestamp,
            };
        });
    });
    clockQueue = operation.then(() => undefined, () => undefined);
    return operation;
}
