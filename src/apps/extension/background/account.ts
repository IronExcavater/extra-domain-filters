import { FirebaseError } from "firebase/app";
import {
    createUserWithEmailAndPassword,
    sendEmailVerification,
    sendPasswordResetEmail,
    signInWithCredential,
    signInWithEmailAndPassword,
    signOut as signOutFirebase,
    updateProfile,
    type Auth,
    type User,
} from "firebase/auth/web-extension";

import type { AccountProvider, AccountState } from "../domain/account/model";
import { getFirebaseServices } from "../infrastructure/firebase/client";
import { AuthBridgeError } from "./authBridge";
import { getProviderCredential } from "./authProviders";

type LoginProvider = AccountProvider;

function getCapabilities(configured: boolean): AccountState["capabilities"] {
    return {
        apple: configured,
        emailPassword: configured,
        facebook: configured,
        google: configured && Boolean(chrome.runtime.getManifest().oauth2?.client_id),
    };
}

function readProviders(user: User): Array<AccountProvider | "email"> {
    const providers = new Set<AccountProvider | "email">();
    for (const profile of user.providerData) {
        if (profile.providerId === "apple.com") providers.add("apple");
        else if (profile.providerId === "facebook.com") providers.add("facebook");
        else if (profile.providerId === "google.com") providers.add("google");
        else if (profile.providerId === "password") providers.add("email");
    }
    return [...providers];
}

function toState(user: User | null, configured = true): AccountState {
    const capabilities = getCapabilities(configured);
    if (!user) return {
        capabilities,
        configured,
        status: configured ? "signed-out" : "unavailable",
    };

    return {
        capabilities,
        configured,
        status: "signed-in",
        profile: {
            uid: user.uid,
            displayName: user.displayName ?? undefined,
            email: user.email ?? undefined,
            emailVerified: user.emailVerified,
            photoUrl: user.photoURL ?? undefined,
            providers: readProviders(user),
        },
    };
}

function waitForAuth(auth: Auth): Promise<User | null> {
    return new Promise((resolve, reject) => {
        let unsubscribe = (): void => undefined;
        unsubscribe = auth.onAuthStateChanged(
            user => {
                unsubscribe();
                resolve(user);
            },
            error => {
                unsubscribe();
                reject(error);
            },
        );
    });
}

function authError(error: unknown, provider?: AccountProvider): Error {
    if (!(error instanceof FirebaseError) && !(error instanceof AuthBridgeError)) {
        return error instanceof Error ? error : new Error("Login did not complete.");
    }
    if (error.code === "auth/operation-not-allowed") {
        const label = provider ? `${provider[0].toUpperCase()}${provider.slice(1)}` : "This";
        return new Error(`${label} login is supported by the extension but is not enabled in Firebase yet.`);
    }
    const messages: Record<string, string> = {
        "auth/account-exists-with-different-credential": "An account already exists for this email. Log in with its original method first.",
        "auth/email-already-in-use": "An account already exists for this email. Try logging in instead.",
        "auth/invalid-credential": "The email or password is incorrect.",
        "auth/invalid-email": "Enter a valid email address.",
        "auth/network-request-failed": "Authentication could not reach the server. Check your connection and try again.",
        "auth/popup-blocked": "The provider login window was blocked. Allow popups and try again.",
        "auth/popup-closed-by-user": "The provider login window was closed before login completed.",
        "auth/too-many-requests": "Too many attempts. Wait a moment, then try again.",
        "auth/unauthorized-domain": "This extension or auth helper domain is not authorized in Firebase.",
        "auth/user-disabled": "This account has been disabled.",
        "auth/weak-password": "Choose a stronger password with at least 8 characters.",
    };
    const message = error.code ? messages[error.code] : undefined;
    if (message) return new Error(message);
    return error instanceof AuthBridgeError
        ? new Error(error.message)
        : new Error("Login did not complete. Please try again.");
}

export async function getAccountState(): Promise<AccountState> {
    const services = await getFirebaseServices();
    if (!services) return toState(null, false);
    return toState(await waitForAuth(services.auth));
}

export async function loginWithProvider(provider: LoginProvider): Promise<AccountState> {
    const services = await getFirebaseServices();
    if (!services) throw new Error("Firebase is not configured for this build.");
    if (!getCapabilities(true)[provider]) {
        throw new Error(`${provider[0].toUpperCase()}${provider.slice(1)} login is not configured for this extension build.`);
    }

    try {
        const credential = await getProviderCredential(provider);
        return toState((await signInWithCredential(services.auth, credential)).user);
    } catch (error) {
        throw authError(error, provider);
    }
}

export async function signInWithEmail(email: string, password: string): Promise<AccountState> {
    const services = await getFirebaseServices();
    if (!services) throw new Error("Firebase is not configured for this build.");
    try {
        return toState((await signInWithEmailAndPassword(services.auth, email.trim(), password)).user);
    } catch (error) {
        throw authError(error);
    }
}

export async function signUpWithEmail(
    email: string,
    password: string,
    displayName?: string,
): Promise<AccountState> {
    const services = await getFirebaseServices();
    if (!services) throw new Error("Firebase is not configured for this build.");
    try {
        const result = await createUserWithEmailAndPassword(services.auth, email.trim(), password);
        const name = displayName?.trim();
        if (name) await updateProfile(result.user, { displayName: name });
        await sendEmailVerification(result.user);
        return toState(result.user);
    } catch (error) {
        throw authError(error);
    }
}

export async function resetPassword(email: string): Promise<void> {
    const services = await getFirebaseServices();
    if (!services) throw new Error("Firebase is not configured for this build.");
    try {
        await sendPasswordResetEmail(services.auth, email.trim());
    } catch (error) {
        throw authError(error);
    }
}

export async function signOut(): Promise<AccountState> {
    const services = await getFirebaseServices();
    if (!services) return toState(null, false);

    await Promise.all([
        signOutFirebase(services.auth),
        chrome.identity.clearAllCachedAuthTokens().catch(() => undefined),
    ]);
    return toState(null);
}
