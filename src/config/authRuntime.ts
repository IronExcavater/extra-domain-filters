import type { AccountProvider } from "../domain/account/model";

export type AuthRuntimeMode = "development" | "production";
export type FederatedAuthProvider = Extract<AccountProvider, "apple" | "facebook">;
export type ProviderTransport = "chrome-identity" | "federated-bridge";

export const ACCOUNT_PROVIDER_TRANSPORTS = {
    apple: "federated-bridge",
    facebook: "federated-bridge",
    google: "chrome-identity",
} as const satisfies Record<AccountProvider, ProviderTransport>;

const DEVELOPMENT_BRIDGE_URL = "http://127.0.0.1:5174/auth/";
const PRODUCTION_BRIDGE_URL = "https://extra-domain-filters.web.app/auth/";
const PRODUCTION_EXTENSION_ORIGIN = "chrome-extension://opblibcobnkicpdjkinngfcbjjnjldkg";
const DEVELOPMENT_EXTENSION_ORIGIN = /^chrome-extension:\/\/[a-p]{32}$/;

export interface FederatedAuthRuntimeConfig {
    bridgeOrigin: string;
    bridgeUrl: string;
    mode: AuthRuntimeMode;
}

function readMode(mode: string): AuthRuntimeMode {
    if (mode === "development" || mode === "production") return mode;
    throw new Error(`Unsupported authentication build mode: ${mode}`);
}

export function getFederatedAuthRuntime(mode: string): FederatedAuthRuntimeConfig {
    const resolvedMode = readMode(mode);
    const bridgeUrl = resolvedMode === "development" ? DEVELOPMENT_BRIDGE_URL : PRODUCTION_BRIDGE_URL;
    return { bridgeOrigin: new URL(bridgeUrl).origin, bridgeUrl, mode: resolvedMode };
}

export function isAllowedExtensionOrigin(origin: string, mode: string): boolean {
    const resolvedMode = readMode(mode);
    return resolvedMode === "development"
        ? DEVELOPMENT_EXTENSION_ORIGIN.test(origin)
        : origin === PRODUCTION_EXTENSION_ORIGIN;
}
