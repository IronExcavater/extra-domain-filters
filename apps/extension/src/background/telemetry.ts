import {
    doc,
    Timestamp,
    writeBatch,
} from "firebase/firestore/lite";
import PQueue from "p-queue";

import { getDeviceId } from "../domain/sync/device";
import type { TelemetryEvent, TelemetryEventInput } from "../domain/telemetry/model";
import { getFirebaseServices } from "../infrastructure/firebase/client";
import { createStorageRepository } from "../platform/repository";
import { onStorageChange } from "../platform/storage";
import { getSettings, type Settings } from "../state/settings";
import { DAY_MS } from "../utils/time";

const MAX_QUEUED_EVENTS = 250;
const RETENTION_MS = 30 * DAY_MS;
// Firestore's writeBatch limit is 500 operations; 400 leaves headroom for the batch's own overhead.
const FIRESTORE_BATCH_SIZE = 400;
const telemetryRepository = createStorageRepository<TelemetryEvent[]>({
    key: "telemetryQueue",
    version: 1,
    createDefault: () => [],
    normalize: value => Array.isArray(value) ? value as TelemetryEvent[] : [],
});

const flushQueue = new PQueue({ concurrency: 1 });

function isEnabled(event: TelemetryEventInput, settings: Settings): boolean {
    return event.name === "diagnostic"
        ? settings.telemetry.diagnosticsEnabled
        : settings.telemetry.analyticsEnabled;
}

export async function trackTelemetry(event: TelemetryEventInput): Promise<void> {
    const settings = await getSettings();
    if (!isEnabled(event, settings)) return;

    await telemetryRepository.update(events => [
        ...events,
        { id: crypto.randomUUID(), createdAt: Date.now(), input: event },
    ].slice(-MAX_QUEUED_EVENTS));
    await requestTelemetryFlush();
}

async function flush(): Promise<void> {
    const [services, settings, events] = await Promise.all([
        getFirebaseServices(),
        getSettings(),
        telemetryRepository.get(),
    ]);
    const user = services?.auth.currentUser;
    if (!services || !user || events.length === 0) return;

    const allowed = events.filter(event => isEnabled(event.input, settings));
    if (allowed.length === 0) {
        await telemetryRepository.clear();
        return;
    }

    const deviceId = await getDeviceId();
    for (let offset = 0; offset < allowed.length; offset += FIRESTORE_BATCH_SIZE) {
        const batch = writeBatch(services.firestore);
        for (const event of allowed.slice(offset, offset + FIRESTORE_BATCH_SIZE)) {
            batch.set(doc(services.firestore, "telemetry", event.id), {
                ...event,
                deviceId,
                expiresAt: Timestamp.fromMillis(event.createdAt + RETENTION_MS),
            });
        }
        await batch.commit();
    }

    const uploaded = new Set(allowed.map(event => event.id));
    await telemetryRepository.update(events => events.filter(event => !uploaded.has(event.id)));
}

export function requestTelemetryFlush(): Promise<void> {
    return flushQueue.add(() => flush());
}

export function startTelemetry(): void {
    onStorageChange<Settings>("settings", next => {
        if (!next) return;
        if (!next.telemetry.analyticsEnabled && !next.telemetry.diagnosticsEnabled) {
            void telemetryRepository.clear();
        }
    });

    void getFirebaseServices().then(services => {
        if (!services) return;
        services.auth.onAuthStateChanged(user => {
            if (user) void requestTelemetryFlush();
        });
    });
}
