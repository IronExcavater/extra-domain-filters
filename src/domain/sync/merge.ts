import { isPlainObject } from "../../shared/utils/types";

export interface LogicalClock {
    counter: number;
    deviceId: string;
    timestamp: number;
}

export interface ClockedValue<T> {
    clock: LogicalClock;
    value: T;
}

export type ClockedFields = Record<string, ClockedValue<unknown>>;

export interface SyncRecord<T> {
    id: string;
    value: T;
    updated: LogicalClock;
    deleted?: LogicalClock;
}

export function normalizeLogicalClock(value: unknown): LogicalClock | undefined {
    if (!isPlainObject(value)) return undefined;
    if (typeof value.deviceId !== "string" || typeof value.timestamp !== "number") {
        return undefined;
    }
    return {
        counter: typeof value.counter === "number" ? value.counter : 0,
        deviceId: value.deviceId,
        timestamp: value.timestamp,
    };
}

export function compareClocks(first: LogicalClock, second: LogicalClock): number {
    if (first.timestamp !== second.timestamp) return first.timestamp - second.timestamp;
    if (first.counter !== second.counter) return first.counter - second.counter;
    return first.deviceId.localeCompare(second.deviceId);
}

export function latestClock<T>(first: ClockedValue<T>, second: ClockedValue<T>): ClockedValue<T> {
    return compareClocks(first.clock, second.clock) >= 0 ? first : second;
}

export function mergeClockedFields(
    local: ClockedFields,
    remote: ClockedFields,
): ClockedFields {
    const merged: ClockedFields = { ...local };

    for (const [field, incoming] of Object.entries(remote)) {
        const current = merged[field];
        merged[field] = current ? latestClock(current, incoming) : incoming;
    }

    return merged;
}

function effectiveClock<T>(record: SyncRecord<T>): LogicalClock {
    if (!record.deleted) return record.updated;
    return compareClocks(record.deleted, record.updated) >= 0
        ? record.deleted
        : record.updated;
}

export function mergeSyncRecord<T>(local: SyncRecord<T>, remote: SyncRecord<T>): SyncRecord<T> {
    return compareClocks(effectiveClock(local), effectiveClock(remote)) >= 0
        ? local
        : remote;
}

export function isDeleted<T>(record: SyncRecord<T>): boolean {
    return Boolean(
        record.deleted && compareClocks(record.deleted, record.updated) >= 0,
    );
}
