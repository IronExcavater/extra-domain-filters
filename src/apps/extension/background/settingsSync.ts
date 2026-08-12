import {
    doc,
    getDoc,
    setDoc,
} from "firebase/firestore/lite";
import PQueue from "p-queue";

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
import { createLogger } from "../platform/logging";
import { createStorageRepository } from "../platform/repository";
import { onStorageChange } from "../platform/storage";
import {
    DEFAULT_SETTINGS,
    getSettings,
    setSettings,
    type Settings,
} from "../state/settings";
import { isPlainObject } from "../utils/types";

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

const logger = createLogger("Settings Sync");
let ignoredSettings = "";
const syncQueue = new PQueue({ concurrency: 1 });

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
    return syncQueue.add(() => synchronize());
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
            .catch(error => logger.warn("Settings sync failed", error));
    });

    void getFirebaseServices().then(services => {
        if (!services) return;
        services.auth.onAuthStateChanged(user => {
            if (user) void requestSettingsSync();
        });
    });
}
