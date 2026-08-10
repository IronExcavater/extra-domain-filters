/// <reference types="vite/client" />

interface ImportMetaEnv {
    readonly VITE_FIREBASE_API_KEY?: string;
    readonly VITE_FIREBASE_APP_ID?: string;
    readonly VITE_FIREBASE_AUTH_DOMAIN?: string;
    readonly VITE_FIREBASE_MEASUREMENT_ID?: string;
    readonly VITE_FIREBASE_MESSAGING_SENDER_ID?: string;
    readonly VITE_FIREBASE_PROJECT_ID?: string;
    readonly VITE_FIREBASE_STORAGE_BUCKET?: string;
    readonly VITE_GOOGLE_OAUTH_CLIENT_ID?: string;
    readonly VITE_FIREBASE_AUTH_HELPER_URL?: string;
    readonly VITE_EXTENSION_ORIGIN?: string;
    readonly VITE_APPLE_AUTH_ENABLED?: string;
    readonly VITE_FACEBOOK_AUTH_ENABLED?: string;
}

interface ImportMeta {
    readonly env: ImportMetaEnv;
}
