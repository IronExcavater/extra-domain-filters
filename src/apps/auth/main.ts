import {
    isAuthPageRequest,
    type AuthPageRequest,
    type AuthResponse,
} from "@shared/authMessages";
import {
    getBundledAuthRuntime,
    isAllowedExtensionOrigin,
    type FederatedAuthProvider,
} from "@shared/config/auth";
import { readFirebaseConfig } from "@shared/config/firebase";
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

const runtime = getBundledAuthRuntime();
const config = readFirebaseConfig();
const auth = config ? getAuth(initializeApp(config)) : undefined;

function createProvider(provider: FederatedAuthProvider): AuthProvider {
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
    provider: FederatedAuthProvider,
    result: Awaited<ReturnType<typeof signInWithPopup>>,
): OAuthCredential | null {
    return provider === "facebook"
        ? FacebookAuthProvider.credentialFromResult(result)
        : OAuthProvider.credentialFromResult(result);
}

function send(target: Window, origin: string, response: AuthResponse): void {
    target.postMessage(response, origin);
}

async function handleAuth(request: AuthPageRequest, target: Window, origin: string): Promise<void> {
    if (!auth) {
        send(target, origin, {
            message: "Firebase is not configured on the hosted authentication bridge.",
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
        send(target, origin, {
            credential: credential.toJSON() as Record<string, unknown>,
            ok: true,
            requestId: request.requestId,
        });
    } catch (error) {
        send(target, origin, {
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
    if (event.source !== window.parent
        || !isAllowedExtensionOrigin(event.origin, runtime.mode)
        || !isAuthPageRequest(event.data)) return;
    void handleAuth(event.data, window.parent, event.origin);
});
