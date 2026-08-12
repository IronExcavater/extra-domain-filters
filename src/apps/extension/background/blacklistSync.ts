import PQueue from "p-queue";

import { getBlacklist, setBlacklist } from "../domain/blacklist/store";
import { normalizeListingUrl } from "../domain/listings/url";
import type { BlacklistEntry } from "../domain/matching";
import {
    getDeviceId,
    nextLogicalClock,
    observeLogicalClocks,
} from "../domain/sync/device";
import {
    isDeleted,
    type SyncRecord,
} from "../domain/sync/merge";
import {
    createEmptySyncRecordState,
    mergeSyncRecordMaps,
    normalizeSyncRecord,
    normalizeSyncRecordState,
    type SyncRecordState,
} from "../domain/sync/records";
import { getFirebaseServices } from "../infrastructure/firebase/client";
import {
    readSyncCollection,
    writeSyncCollection,
} from "../infrastructure/firebase/syncCollection";
import { createLogger } from "../platform/logging";
import { createStorageRepository } from "../platform/repository";
import { onStorageChange } from "../platform/storage";
import { getSettings } from "../state/settings";
import { isPlainObject } from "../utils/types";

interface BlacklistSyncValue {
    addedAt: number;
    url: string;
}

type BlacklistSyncState = SyncRecordState<BlacklistSyncValue>;

const syncRepository = createStorageRepository<BlacklistSyncState>({
    key: "blacklistSync",
    version: 1,
    createDefault: createEmptySyncRecordState,
    normalize: value => normalizeSyncRecordState(value, normalizeRecord),
});

const logger = createLogger("Blacklist Sync");
let ignoredBlacklist = "";
const syncQueue = new PQueue({ concurrency: 1 });

function fingerprint(entries: readonly BlacklistEntry[]): string {
    return JSON.stringify(entries.map(entry => ({
        url: normalizeListingUrl(entry.url),
        removedAt: entry.removedAt ?? null,
    })));
}

function normalizeBlacklistSyncValue(value: unknown): BlacklistSyncValue | undefined {
    if (!isPlainObject(value)) return undefined;
    if (
        typeof value.url !== "string" ||
        typeof value.addedAt !== "number"
    ) return undefined;

    return {
        url: normalizeListingUrl(value.url),
        addedAt: value.addedAt,
    };
}

function normalizeRecord(value: unknown): SyncRecord<BlacklistSyncValue> | undefined {
    return normalizeSyncRecord(value, normalizeBlacklistSyncValue);
}

async function getRecordId(url: string): Promise<string> {
    const bytes = new TextEncoder().encode(normalizeListingUrl(url));
    const digest = await crypto.subtle.digest("SHA-256", bytes);
    return [...new Uint8Array(digest)]
        .map(value => value.toString(16).padStart(2, "0"))
        .join("");
}

async function seedRecords(
    entries: readonly BlacklistEntry[],
    deviceId: string,
): Promise<Record<string, SyncRecord<BlacklistSyncValue>>> {
    const records: Record<string, SyncRecord<BlacklistSyncValue>> = {};

    for (const entry of entries) {
        const id = await getRecordId(entry.url);
        records[id] = {
            id,
            value: { url: normalizeListingUrl(entry.url), addedAt: entry.addedAt },
            updated: { counter: 0, deviceId, timestamp: entry.addedAt },
            deleted: entry.removedAt
                ? { counter: 0, deviceId, timestamp: entry.removedAt }
                : undefined,
        };
    }

    return records;
}

async function recordLocalChange(
    next: readonly BlacklistEntry[],
    previous: readonly BlacklistEntry[],
): Promise<void> {
    const deviceId = await getDeviceId();
    const previousByUrl = new Map(previous.map(entry => [normalizeListingUrl(entry.url), entry]));
    const nextByUrl = new Map(next.map(entry => [normalizeListingUrl(entry.url), entry]));

    await syncRepository.update(async state => {
        const records = Object.keys(state.records).length > 0
            ? { ...state.records }
            : await seedRecords(previous, deviceId);
        const urls = new Set([...previousByUrl.keys(), ...nextByUrl.keys()]);

        for (const url of urls) {
            const prior = previousByUrl.get(url);
            const entry = nextByUrl.get(url);
            const source = entry ?? prior;
            if (!source) continue;
            const wasActive = Boolean(prior && !prior.removedAt);
            const isActive = Boolean(entry && !entry.removedAt);
            const changed = !prior || wasActive !== isActive;
            if (!changed) continue;

            const id = await getRecordId(url);
            const existing = records[id];
            const clock = await nextLogicalClock();
            records[id] = {
                id,
                value: {
                    url,
                    addedAt: existing?.value.addedAt ?? source.addedAt,
                },
                updated: isActive ? clock : existing?.updated ?? clock,
                deleted: isActive ? existing?.deleted : clock,
            };
        }

        return { ...state, records };
    });
}

function materializeBlacklist(
    records: Record<string, SyncRecord<BlacklistSyncValue>>,
    current: readonly BlacklistEntry[],
): BlacklistEntry[] {
    const existing = new Map(current.map(entry => [normalizeListingUrl(entry.url), entry]));

    return Object.values(records)
        .map(record => {
            const entry = existing.get(record.value.url);
            return {
                ...entry,
                url: record.value.url,
                addedAt: entry?.addedAt ?? record.value.addedAt,
                removedAt: isDeleted(record) ? record.deleted?.timestamp : undefined,
            } satisfies BlacklistEntry;
        })
        .sort((first, second) => first.addedAt - second.addedAt);
}

async function synchronize(): Promise<void> {
    const services = await getFirebaseServices();
    if (!services?.auth.currentUser || !(await getSettings()).sync.enabled) return;

    const current = await getBlacklist();
    const deviceId = await getDeviceId();
    let local = await syncRepository.get();
    if (Object.keys(local.records).length === 0) {
        local = { records: await seedRecords(current, deviceId) };
    }

    const remote = await readSyncCollection(
        services.firestore,
        ["users", services.auth.currentUser.uid, "blacklist"],
        normalizeRecord,
    );
    await observeLogicalClocks(Object.values(remote).flatMap(record =>
        record.deleted ? [record.updated, record.deleted] : [record.updated]
    ));

    const merged = mergeSyncRecordMaps(local.records, remote);
    const resolved = materializeBlacklist(merged, current);
    if (fingerprint(resolved) !== fingerprint(current)) {
        ignoredBlacklist = fingerprint(resolved);
        await setBlacklist(resolved);
    }

    await writeSyncCollection(
        services.firestore,
        ["users", services.auth.currentUser.uid, "blacklist"],
        merged,
    );
    await syncRepository.set({ records: merged, lastSyncedAt: Date.now() });
}

export function requestBlacklistSync(): Promise<void> {
    return syncQueue.add(() => synchronize());
}

export function startBlacklistSync(): void {
    onStorageChange<BlacklistEntry[]>("blacklist", (next, previous) => {
        if (!next) return;
        if (ignoredBlacklist && fingerprint(next) === ignoredBlacklist) {
            ignoredBlacklist = "";
            return;
        }

        void recordLocalChange(next, previous ?? [])
            .then(requestBlacklistSync)
            .catch(error => logger.warn("Blacklist sync failed", error));
    });

    void getFirebaseServices().then(services => {
        if (!services) return;
        services.auth.onAuthStateChanged(user => {
            if (user) void requestBlacklistSync();
        });
    });
}
