import { isPlainObject } from "../../shared/utils/types";
import {
    mergeSyncRecord,
    normalizeLogicalClock,
    type SyncRecord,
} from "./merge";

export interface SyncRecordState<T> {
    lastSyncedAt?: number;
    records: Record<string, SyncRecord<T>>;
}

export function createEmptySyncRecordState<T>(): SyncRecordState<T> {
    return { records: {} };
}

export function normalizeSyncRecord<T>(
    value: unknown,
    normalizeValue: (value: unknown) => T | undefined,
): SyncRecord<T> | undefined {
    if (!isPlainObject(value)) return undefined;

    const updated = normalizeLogicalClock(value.updated);
    const deleted = value.deleted === undefined
        ? undefined
        : normalizeLogicalClock(value.deleted);
    const normalizedValue = normalizeValue(value.value);

    if (
        typeof value.id !== "string" ||
        !updated ||
        !normalizedValue ||
        (value.deleted !== undefined && !deleted)
    ) return undefined;

    return {
        id: value.id,
        value: normalizedValue,
        updated,
        deleted,
    };
}

export function normalizeSyncRecordMap<T>(
    value: unknown,
    normalizeRecord: (value: unknown) => SyncRecord<T> | undefined,
): Record<string, SyncRecord<T>> {
    if (!isPlainObject(value)) return {};

    const records: Record<string, SyncRecord<T>> = {};
    for (const candidate of Object.values(value)) {
        const record = normalizeRecord(candidate);
        if (record) records[record.id] = record;
    }
    return records;
}

export function normalizeSyncRecordState<T>(
    value: unknown,
    normalizeRecord: (value: unknown) => SyncRecord<T> | undefined,
): SyncRecordState<T> {
    if (!isPlainObject(value)) return createEmptySyncRecordState();

    return {
        records: normalizeSyncRecordMap(value.records, normalizeRecord),
        lastSyncedAt: typeof value.lastSyncedAt === "number"
            ? value.lastSyncedAt
            : undefined,
    };
}

export function mergeSyncRecordMaps<T>(
    local: Record<string, SyncRecord<T>>,
    remote: Record<string, SyncRecord<T>>,
): Record<string, SyncRecord<T>> {
    const merged = { ...local };
    for (const [id, record] of Object.entries(remote)) {
        merged[id] = merged[id] ? mergeSyncRecord(merged[id], record) : record;
    }
    return merged;
}

