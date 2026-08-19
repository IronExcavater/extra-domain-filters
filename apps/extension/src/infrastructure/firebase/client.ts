import { readFirebaseConfig } from "@extra-domain-filters/shared/config/firebase";
import {
    getApp,
    getApps,
    initializeApp,
    type FirebaseApp,
} from "firebase/app";
import {
    getAuth,
    indexedDBLocalPersistence,
    inMemoryPersistence,
    setPersistence,
    type Auth,
} from "firebase/auth/web-extension";
import {
    getFirestore,
    type Firestore,
} from "firebase/firestore/lite";

export interface FirebaseServices {
    app: FirebaseApp;
    auth: Auth;
    firestore: Firestore;
}

let services: Promise<FirebaseServices | undefined> | undefined;

async function initializeServices(): Promise<FirebaseServices | undefined> {
    const config = readFirebaseConfig();
    if (!config) return undefined;

    const existing = getApps().length > 0;
    const app = existing ? getApp() : initializeApp(config);
    const auth = getAuth(app);
    try {
        await setPersistence(auth, indexedDBLocalPersistence);
    } catch {
        await setPersistence(auth, inMemoryPersistence);
    }
    const firestore = getFirestore(app);

    return { app, auth, firestore };
}

export function getFirebaseServices(): Promise<FirebaseServices | undefined> {
    services ??= initializeServices();
    return services;
}
