import {
    getSavedSearches,
    normalizeSavedSearch,
    setSavedSearches,
    type SavedSearch,
} from "../domain/searches/savedSearches";
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
import { createStorageRepository } from "../platform/repository";
import { onStorageChange } from "../platform/storage";
import { getSettings } from "../state/settings";

type SavedSearchSyncState = SyncRecordState<SavedSearch>;

const syncRepository = createStorageRepository<SavedSearchSyncState>({
    key: "savedSearchSync",
    version: 1,
    createDefault: createEmptySyncRecordState,
    normalize: value => normalizeSyncRecordState(value, normalizeRecord),
});

let ignoredSearches = "";
let syncQueue = Promise.resolve();

function fingerprint(searches: readonly SavedSearch[]): string {
    return JSON.stringify([...searches]
        .sort((first, second) => first.id.localeCompare(second.id))
        .map(search => ({ ...search })));
}

function seedRecords(
    searches: readonly SavedSearch[],
    deviceId: string,
): Record<string, SyncRecord<SavedSearch>> {
    return Object.fromEntries(searches.map(search => [search.id, {
        id: search.id,
        updated: { counter: 0, deviceId, timestamp: search.updatedAt },
        value: search,
    }]));
}

function normalizeRecord(value: unknown): SyncRecord<SavedSearch> | undefined {
    const record = normalizeSyncRecord(value, normalizeSavedSearch);
    return record && record.id === record.value.id ? record : undefined;
}

async function recordLocalChange(
    next: readonly SavedSearch[],
    previous: readonly SavedSearch[],
): Promise<void> {
    const deviceId = await getDeviceId();
    const nextById = new Map(next.map(search => [search.id, search]));
    const previousById = new Map(previous.map(search => [search.id, search]));

    await syncRepository.update(async state => {
        const records = Object.keys(state.records).length > 0
            ? { ...state.records }
            : seedRecords(previous, deviceId);
        const ids = new Set([...previousById.keys(), ...nextById.keys()]);
        for (const id of ids) {
            const prior = previousById.get(id);
            const current = nextById.get(id);
            if (fingerprint(current ? [current] : []) === fingerprint(prior ? [prior] : [])) continue;
            const clock = await nextLogicalClock();
            const existing = records[id];
            if (current) {
                records[id] = { id, value: current, updated: clock, deleted: existing?.deleted };
            } else if (existing) {
                records[id] = { ...existing, deleted: clock };
            }
        }
        return { ...state, records };
    });
}

async function synchronize(): Promise<void> {
    const services = await getFirebaseServices();
    const user = services?.auth.currentUser;
    if (!services || !user || !(await getSettings()).sync.enabled) return;

    const current = await getSavedSearches();
    const deviceId = await getDeviceId();
    let local = await syncRepository.get();
    if (Object.keys(local.records).length === 0) {
        local = { records: seedRecords(current, deviceId) };
    }

    const remote = await readSyncCollection(
        services.firestore,
        ["users", user.uid, "savedSearches"],
        normalizeRecord,
    );
    await observeLogicalClocks(Object.values(remote).flatMap(record =>
        record.deleted ? [record.updated, record.deleted] : [record.updated]
    ));

    const merged = mergeSyncRecordMaps(local.records, remote);
    const resolved = Object.values(merged)
        .filter(record => !isDeleted(record))
        .map(record => record.value)
        .sort((first, second) => first.createdAt - second.createdAt);
    if (fingerprint(resolved) !== fingerprint(current)) {
        ignoredSearches = fingerprint(resolved);
        await setSavedSearches(resolved);
    }

    await writeSyncCollection(
        services.firestore,
        ["users", user.uid, "savedSearches"],
        merged,
    );
    await syncRepository.set({ records: merged, lastSyncedAt: Date.now() });
}

export function requestSavedSearchSync(): Promise<void> {
    const operation = syncQueue.then(synchronize);
    syncQueue = operation.catch(() => undefined);
    return operation;
}

export function startSavedSearchSync(): void {
    onStorageChange<SavedSearch[]>("savedSearches", (next, previous) => {
        if (!next) return;
        if (ignoredSearches && fingerprint(next) === ignoredSearches) {
            ignoredSearches = "";
            return;
        }
        void recordLocalChange(next, previous ?? [])
            .then(requestSavedSearchSync)
            .catch(error => console.warn("[Extra Domain Filters] Saved search sync failed", error));
    });

    void getFirebaseServices().then(services => {
        if (!services) return;
        services.auth.onAuthStateChanged(user => {
            if (user) void requestSavedSearchSync();
        });
    });
}
