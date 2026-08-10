import type { FirebaseOptions } from "firebase/app";

export function readFirebaseConfig(): FirebaseOptions | undefined {
    const config = {
        apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
        appId: import.meta.env.VITE_FIREBASE_APP_ID,
        authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
        measurementId: import.meta.env.VITE_FIREBASE_MEASUREMENT_ID,
        messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
        projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
        storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET,
    } satisfies FirebaseOptions;

    return config.apiKey && config.appId && config.projectId ? config : undefined;
}

export function readFederatedAuthHelperUrl(): string | undefined {
    const value = import.meta.env.VITE_FIREBASE_AUTH_HELPER_URL?.trim();
    if (!value) return undefined;
    try {
        const url = new URL(value);
        return url.protocol === "https:" ? url.href : undefined;
    } catch {
        return undefined;
    }
}

export function isFederatedProviderEnabled(provider: "apple" | "facebook"): boolean {
    const value = provider === "apple"
        ? import.meta.env.VITE_APPLE_AUTH_ENABLED
        : import.meta.env.VITE_FACEBOOK_AUTH_ENABLED;
    return value?.trim().toLowerCase() === "true";
}
