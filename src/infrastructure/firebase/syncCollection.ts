import {
    collection,
    doc,
    getDocs,
    type Firestore,
    writeBatch,
} from "firebase/firestore/lite";

import type { SyncRecord } from "../../domain/sync/merge";

const BATCH_SIZE = 400;

export async function readSyncCollection<T>(
    firestore: Firestore,
    path: readonly [string, ...string[]],
    normalize: (value: unknown) => SyncRecord<T> | undefined,
): Promise<Record<string, SyncRecord<T>>> {
    const reference = collection(firestore, path[0], ...path.slice(1));
    const snapshots = await getDocs(reference);
    const records: Record<string, SyncRecord<T>> = {};
    for (const snapshot of snapshots.docs) {
        const record = normalize(snapshot.data());
        if (record) records[record.id] = record;
    }
    return records;
}

export async function writeSyncCollection<T>(
    firestore: Firestore,
    path: readonly [string, ...string[]],
    records: Record<string, SyncRecord<T>>,
): Promise<void> {
    const reference = collection(firestore, path[0], ...path.slice(1));
    const entries = Object.values(records);
    for (let offset = 0; offset < entries.length; offset += BATCH_SIZE) {
        const batch = writeBatch(firestore);
        for (const record of entries.slice(offset, offset + BATCH_SIZE)) {
            batch.set(doc(reference, record.id), record);
        }
        await batch.commit();
    }
}
