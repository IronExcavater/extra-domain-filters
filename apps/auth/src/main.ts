import {
    isAuthPageRequest,
    isFederatedAuthProvider,
    type AuthBridgeReady,
    type AuthPageRequest,
    type AuthResponse,
    type TabAuthResult,
} from "@extra-domain-filters/shared/authMessages";
import {
    getBundledAuthRuntime,
    isAllowedExtensionOrigin,
    type FederatedAuthProvider,
} from "@extra-domain-filters/shared/config/auth";
import { readFirebaseConfig } from "@extra-domain-filters/shared/config/firebase";
import { initializeApp } from "firebase/app";
import {
    FacebookAuthProvider,
    getAuth,
    GoogleAuthProvider,
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
    if (provider === "google") {
        const google = new GoogleAuthProvider();
        google.addScope("email");
        google.addScope("profile");
        return google;
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
        : provider === "google"
            ? GoogleAuthProvider.credentialFromResult(result)
        : OAuthProvider.credentialFromResult(result);
}

function send(target: Window, origin: string, response: AuthResponse): void {
    target.postMessage(response, origin);
}

/** Signs in with the provider's popup and returns the credential for the extension to reuse. */
async function authenticate(request: AuthPageRequest): Promise<AuthResponse> {
    if (!auth) {
        return { message: "Firebase is not configured on the hosted authentication bridge.", ok: false, requestId: request.requestId };
    }
    try {
        await setPersistence(auth, inMemoryPersistence);
        const result = await signInWithPopup(auth, createProvider(request.provider));
        const credential = readCredential(request.provider, result);
        if (!credential) throw new Error("The provider did not return a reusable credential.");
        return { credential: credential.toJSON() as Record<string, unknown>, ok: true, requestId: request.requestId };
    } catch (error) {
        return {
            code: error && typeof error === "object" && "code" in error && typeof error.code === "string"
                ? error.code
                : undefined,
            message: error instanceof Error ? error.message : "Login did not complete.",
            ok: false,
            requestId: request.requestId,
        };
    } finally {
        await signOut(auth).catch(error => console.warn("Auth bridge sign-out cleanup failed", error));
    }
}

async function handleAuth(request: AuthPageRequest, target: Window, origin: string): Promise<void> {
    send(target, origin, await authenticate(request));
}

const PROVIDER_NAMES = { apple: "Apple", facebook: "Facebook", google: "Google" } as const;

/**
 * Tab mode (`?flow=tab&provider=…&state=…`): browsers without offscreen documents (Firefox,
 * Safari) or whose extension ID this page doesn't know (Edge, Opera) open this page in a tab.
 * A click starts the provider's popup (browsers only allow popups from a click); the result is
 * posted to this window, where the extension's content script picks it up.
 */
function startTabFlow(params: URLSearchParams): boolean {
    const provider = params.get("provider");
    const state = params.get("state");
    if (params.get("flow") !== "tab" || !isFederatedAuthProvider(provider) || !state) return false;

    const name = PROVIDER_NAMES[provider];
    const main = document.querySelector("main") ?? document.body;
    const title = document.createElement("h1");
    const text = document.createElement("p");
    const button = document.createElement("button");
    const status = document.createElement("p");
    title.textContent = "Sign in to Extra Domain Filters";
    text.textContent = `Continue with ${name} to sync your filters, blacklist and saved searches.`;
    button.type = "button";
    button.className = `provider provider-${provider}`;
    button.textContent = `Continue with ${name}`;
    status.className = "status";
    status.role = "status";
    button.addEventListener("click", async () => {
        button.disabled = true;
        status.textContent = `Finish signing in with ${name} in the window that opened.`;
        const response = await authenticate({ provider, requestId: state, type: "federated-auth:start" });
        window.postMessage({ response, type: "federated-auth:tab-result" } satisfies TabAuthResult, window.location.origin);
        if (response.ok) {
            status.textContent = "You're signed in. This tab closes by itself.";
        } else {
            status.textContent = response.message;
            button.disabled = false;
        }
    });
    main.replaceChildren(title, text, button, status);
    return true;
}

startTabFlow(new URLSearchParams(window.location.search));

window.addEventListener("message", event => {
    if (event.source !== window.parent
        || !isAllowedExtensionOrigin(event.origin, runtime.mode)
        || !isAuthPageRequest(event.data)) return;
    void handleAuth(event.data, window.parent, event.origin);
});

// Tell the extension's offscreen document this page loaded and is listening.
const parentOrigin = window.location.ancestorOrigins?.[0];
if (window.parent !== window && parentOrigin && isAllowedExtensionOrigin(parentOrigin, runtime.mode)) {
    window.parent.postMessage({ type: "federated-auth:ready" } satisfies AuthBridgeReady, parentOrigin);
}
