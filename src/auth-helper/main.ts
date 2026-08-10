import { initializeApp } from "firebase/app";
import {
    FacebookAuthProvider,
    getAuth,
    inMemoryPersistence,
    OAuthProvider,
    setPersistence,
    signInWithPopup,
    signOut,
    type AuthProvider,
    type OAuthCredential,
} from "firebase/auth";

import { readFirebaseConfig } from "../infrastructure/firebase/config";
import type { FederatedAccountProvider, FederatedAuthBridgeResponse } from "../shared/platform/authBridge";

interface HostedAuthRequest {
    provider: FederatedAccountProvider;
    requestId: string;
    type: "federated-auth:start";
}

const extensionOrigin = import.meta.env.VITE_EXTENSION_ORIGIN?.trim();
const config = readFirebaseConfig();
const auth = config ? getAuth(initializeApp(config)) : undefined;

function readRequest(value: unknown): HostedAuthRequest | undefined {
    if (!value || typeof value !== "object") return undefined;
    const candidate = value as Partial<HostedAuthRequest>;
    if (candidate.type !== "federated-auth:start" || typeof candidate.requestId !== "string") return undefined;
    if (candidate.provider !== "apple" && candidate.provider !== "facebook") return undefined;
    return candidate as HostedAuthRequest;
}

function createProvider(provider: FederatedAccountProvider): AuthProvider {
    if (provider === "facebook") {
        const facebook = new FacebookAuthProvider();
        facebook.addScope("email");
        return facebook;
    }
    const apple = new OAuthProvider("apple.com");
    apple.addScope("email");
    apple.addScope("name");
    return apple;
}

function readCredential(
    provider: FederatedAccountProvider,
    result: Awaited<ReturnType<typeof signInWithPopup>>,
): OAuthCredential | null {
    return provider === "facebook"
        ? FacebookAuthProvider.credentialFromResult(result)
        : OAuthProvider.credentialFromResult(result);
}

function send(target: Window, origin: string, response: FederatedAuthBridgeResponse): void {
    target.postMessage(response, origin);
}

async function handleAuth(request: HostedAuthRequest, origin: string): Promise<void> {
    if (!auth) {
        send(window.parent, origin, {
            message: "Firebase is not configured on the hosted authentication page.",
            ok: false,
            requestId: request.requestId,
        });
        return;
    }
    try {
        await setPersistence(auth, inMemoryPersistence);
        const result = await signInWithPopup(auth, createProvider(request.provider));
        const credential = readCredential(request.provider, result);
        if (!credential) throw new Error("The provider did not return a reusable credential.");
        send(window.parent, origin, {
            credential: credential.toJSON() as Record<string, unknown>,
            ok: true,
            requestId: request.requestId,
        });
    } catch (error) {
        send(window.parent, origin, {
            code: error && typeof error === "object" && "code" in error && typeof error.code === "string"
                ? error.code
                : undefined,
            message: error instanceof Error ? error.message : "Login did not complete.",
            ok: false,
            requestId: request.requestId,
        });
    } finally {
        await signOut(auth).catch(() => undefined);
    }
}

window.addEventListener("message", event => {
    const request = readRequest(event.data);
    if (!request || event.source !== window.parent || !extensionOrigin || event.origin !== extensionOrigin) return;
    void handleAuth(request, event.origin);
});
