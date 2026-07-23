import {
    GoogleAuthProvider,
    signInWithCredential,
    signOut as signOutFirebase,
    type Auth,
    type User,
} from "firebase/auth/web-extension";

import type { AccountState } from "../domain/account/model";
import { getFirebaseServices } from "../infrastructure/firebase/client";

function toState(user: User | null, configured = true): AccountState {
    if (!user) return { configured, status: "signed-out" };

    return {
        configured,
        status: "signed-in",
        profile: {
            uid: user.uid,
            displayName: user.displayName ?? undefined,
            email: user.email ?? undefined,
            photoUrl: user.photoURL ?? undefined,
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

async function getGoogleAccessToken(): Promise<string> {
    const clientId = chrome.runtime.getManifest().oauth2?.client_id;
    if (!clientId) throw new Error("Google OAuth is not configured for this extension build.");

    const redirectUri = chrome.identity.getRedirectURL("google-auth");
    const authorizationUrl = new URL("https://accounts.google.com/o/oauth2/v2/auth");
    authorizationUrl.search = new URLSearchParams({
        client_id: clientId,
        prompt: "select_account",
        redirect_uri: redirectUri,
        response_type: "token",
        scope: "openid https://www.googleapis.com/auth/userinfo.email https://www.googleapis.com/auth/userinfo.profile",
    }).toString();

    const responseUrl = await chrome.identity.launchWebAuthFlow({
        interactive: true,
        url: authorizationUrl.href,
    });
    if (!responseUrl) throw new Error("Google sign-in did not complete.");

    const accessToken = new URL(responseUrl).hash.slice(1);
    const token = new URLSearchParams(accessToken).get("access_token");
    if (!token) throw new Error("Google did not return an OAuth access token.");
    return token;
}

export async function getAccountState(): Promise<AccountState> {
    const services = await getFirebaseServices();
    if (!services) return { configured: false, status: "unavailable" };
    return toState(await waitForAuth(services.auth));
}

export async function signIn(): Promise<AccountState> {
    const services = await getFirebaseServices();
    if (!services) throw new Error("Firebase is not configured for this build.");

    const credential = GoogleAuthProvider.credential(null, await getGoogleAccessToken());
    const result = await signInWithCredential(services.auth, credential);
    return toState(result.user);
}

export async function signOut(): Promise<AccountState> {
    const services = await getFirebaseServices();
    if (!services) return { configured: false, status: "unavailable" };

    await Promise.all([
        signOutFirebase(services.auth),
        chrome.identity.clearAllCachedAuthTokens().catch(() => undefined),
    ]);
    return toState(null);
}
