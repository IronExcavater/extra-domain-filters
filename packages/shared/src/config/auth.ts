declare global {
    const __AUTH_BRIDGE_URL__: string;
    const __AUTH_BRIDGE_MODE__: "development" | "production";
}

export type AuthRuntimeMode = "development" | "production";
export type FederatedAuthProvider = "apple" | "facebook" | "google";

export const DEVELOPMENT_BRIDGE_URL = "http://127.0.0.1:5174/auth/";
const PRODUCTION_BRIDGE_URL = "https://extra-domain-filters.web.app/auth/";
/**
 * Store builds allowed to use the hosted sign-in page. Each store gives the extension its own
 * ID; add the Edge Add-ons and Opera add-ons IDs here once those listings exist (Firefox and
 * Safari have no offscreen documents, so they sign in by email instead).
 */
const PRODUCTION_EXTENSION_ORIGINS: readonly string[] = [
    "chrome-extension://opblibcobnkicpdjkinngfcbjjnjldkg",
];
const DEVELOPMENT_EXTENSION_ORIGIN = /^chrome-extension:\/\/[a-p]{32}$/;

export interface AuthRuntimeConfig {
    bridgeOrigin: string;
    bridgeUrl: string;
    mode: AuthRuntimeMode;
}

function readMode(mode: string): AuthRuntimeMode {
    if (mode === "development" || mode === "production") return mode;
    throw new Error(`Unsupported authentication build mode: ${mode}`);
}

export function getAuthRuntime(mode: string): AuthRuntimeConfig {
    const resolvedMode = readMode(mode);
    const bridgeUrl = resolvedMode === "development" ? DEVELOPMENT_BRIDGE_URL : PRODUCTION_BRIDGE_URL;
    return { bridgeOrigin: new URL(bridgeUrl).origin, bridgeUrl, mode: resolvedMode };
}

export function getBundledAuthRuntime(): AuthRuntimeConfig {
    const mode = readMode(__AUTH_BRIDGE_MODE__);
    const bridgeUrl = __AUTH_BRIDGE_URL__;
    return { bridgeOrigin: new URL(bridgeUrl).origin, bridgeUrl, mode };
}

export function isAllowedExtensionOrigin(origin: string, mode: string): boolean {
    const resolvedMode = readMode(mode);
    return resolvedMode === "development"
        ? DEVELOPMENT_EXTENSION_ORIGIN.test(origin)
        : PRODUCTION_EXTENSION_ORIGINS.includes(origin);
}
