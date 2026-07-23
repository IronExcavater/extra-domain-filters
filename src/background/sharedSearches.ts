import {
    collection,
    doc,
    getDoc,
    serverTimestamp,
    setDoc,
    Timestamp,
} from "firebase/firestore/lite";

import type { SharedSearch } from "../domain/searches/model";
import { getFirebaseServices } from "../infrastructure/firebase/client";
import { isPlainObject } from "../shared/utils/types";

const SHARE_LIFETIME_MS = 7 * 24 * 60 * 60 * 1000;

function readTimestamp(value: unknown): number | undefined {
    if (typeof value === "number") return value;
    return isPlainObject(value) && typeof value.toMillis === "function"
        ? value.toMillis()
        : undefined;
}

function normalizeSharedSearch(id: string, value: unknown): SharedSearch | undefined {
    if (!isPlainObject(value)) return undefined;
    const createdAt = readTimestamp(value.createdAt);
    const expiresAt = readTimestamp(value.expiresAt);
    if (
        createdAt === undefined ||
        expiresAt === undefined ||
        typeof value.params !== "string" ||
        expiresAt <= Date.now()
    ) return undefined;
    return { createdAt, expiresAt, id, params: value.params };
}

export async function createSharedSearch(params: string): Promise<SharedSearch> {
    const services = await getFirebaseServices();
    const user = services?.auth.currentUser;
    if (!services || !user) throw new Error("Sign in to create a hosted share link.");

    const reference = doc(collection(
        services.firestore,
        "sharedSearches",
    ));
    const createdAt = Date.now();
    const sharedSearch = {
        createdAt,
        expiresAt: createdAt + SHARE_LIFETIME_MS,
        id: reference.id,
        params,
    } satisfies SharedSearch;
    await setDoc(reference, {
        createdAt: serverTimestamp(),
        expiresAt: Timestamp.fromMillis(sharedSearch.expiresAt),
        id: sharedSearch.id,
        ownerId: user.uid,
        params: sharedSearch.params,
        schemaVersion: 1,
    });
    return sharedSearch;
}

export async function getSharedSearch(id: string): Promise<SharedSearch | undefined> {
    const services = await getFirebaseServices();
    if (!services) return undefined;

    const snapshot = await getDoc(doc(
        services.firestore,
        "sharedSearches",
        id,
    ));
    return snapshot.exists() ? normalizeSharedSearch(snapshot.id, snapshot.data()) : undefined;
}
