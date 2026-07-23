import {
    doc,
    getDoc,
    setDoc,
} from "firebase/firestore/lite";

import { nextLogicalClock, observeLogicalClocks } from "../domain/sync/device";
import {
    mergeClockedFields,
    normalizeLogicalClock,
    type ClockedFields,
} from "../domain/sync/merge";
import {
    clockSettings,
    materializeSettings,
    recordSettingsChanges,
} from "../domain/sync/settings";
import { getFirebaseServices } from "../infrastructure/firebase/client";
import { createStorageRepository } from "../shared/platform/repository";
import { onStorageChange } from "../shared/platform/storage";
import {
    DEFAULT_SETTINGS,
    getSettings,
    setSettings,
    type Settings,
} from "../shared/state/settings";
import { isPlainObject } from "../shared/utils/types";

interface SettingsSyncState {
    fields: ClockedFields;
    lastSyncedAt?: number;
}

const syncRepository = createStorageRepository<SettingsSyncState>({
    key: "settingsSync",
    version: 1,
    createDefault: () => ({ fields: {} }),
    normalize: value => {
        if (!isPlainObject(value)) return { fields: {} };
        return {
            fields: normalizeRemoteFields(value.fields),
            lastSyncedAt: typeof value.lastSyncedAt === "number"
                ? value.lastSyncedAt
                : undefined,
        };
    },
});

let ignoredSettings = "";
let syncQueue = Promise.resolve();

function fingerprint(settings: Settings): string {
    return JSON.stringify(settings);
}

function normalizeRemoteFields(value: unknown): ClockedFields {
    if (!isPlainObject(value)) return {};
    const fields: ClockedFields = {};
    for (const [key, candidate] of Object.entries(value)) {
        if (!isPlainObject(candidate)) continue;
        const clock = normalizeLogicalClock(candidate.clock);
        if (clock) fields[key] = { clock, value: candidate.value };
    }
    return fields;
}

async function recordLocalChange(next: Settings, previous: Settings): Promise<void> {
    await syncRepository.update(async state => ({
        ...state,
        fields: recordSettingsChanges(
            state.fields,
            previous,
            next,
            await nextLogicalClock(),
        ),
    }));
}

async function synchronize(): Promise<void> {
    const services = await getFirebaseServices();
    if (!services) return;

    const user = services.auth.currentUser;
    const settings = await getSettings();
    if (!user || !settings.sync.enabled) return;

    let local = await syncRepository.get();
    if (Object.keys(local.fields).length === 0) {
        local = {
            fields: clockSettings(settings, await nextLogicalClock()),
        };
    }

    const reference = doc(
        services.firestore,
        "users",
        user.uid,
        "settings",
        "preferences",
    );
    const snapshot = await getDoc(reference);
    const remote = snapshot.exists()
        ? normalizeRemoteFields(snapshot.data().fields)
        : {};
    await observeLogicalClocks(Object.values(remote).map(field => field.clock));
    const merged = mergeClockedFields(local.fields, remote);
    const resolved = materializeSettings(merged, settings);

    if (fingerprint(resolved) !== fingerprint(settings)) {
        ignoredSettings = fingerprint(resolved);
        await setSettings(resolved);
    }

    await setDoc(reference, {
        fields: merged,
        schemaVersion: 1,
        updatedAt: Date.now(),
    });
    await syncRepository.set({ fields: merged, lastSyncedAt: Date.now() });
}

export function requestSettingsSync(): Promise<void> {
    const operation = syncQueue.then(synchronize);
    syncQueue = operation.catch(() => undefined);
    return operation;
}

export function startSettingsSync(): void {
    onStorageChange<Settings>("settings", (next, previous) => {
        if (!next) return;
        if (ignoredSettings && fingerprint(next) === ignoredSettings) {
            ignoredSettings = "";
            return;
        }

        void recordLocalChange(next, previous ?? DEFAULT_SETTINGS)
            .then(requestSettingsSync)
            .catch(error => console.warn("[Extra Domain Filters] Settings sync failed", error));
    });

    void getFirebaseServices().then(services => {
        if (!services) return;
        services.auth.onAuthStateChanged(user => {
            if (user) void requestSettingsSync();
        });
    });
}
