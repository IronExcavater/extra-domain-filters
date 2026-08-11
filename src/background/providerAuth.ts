import {
    GoogleAuthProvider,
    OAuthCredential,
    type AuthCredential,
} from "firebase/auth/web-extension";

import {
    ACCOUNT_PROVIDER_TRANSPORTS,
    type ProviderTransport,
} from "../config/authRuntime";
import type { AccountProvider } from "../domain/account/model";
import { getFederatedCredential } from "./federatedAuthBridge";

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
    if (!responseUrl) throw new Error("Google login did not complete.");

    const accessToken = new URLSearchParams(new URL(responseUrl).hash.slice(1)).get("access_token");
    if (!accessToken) throw new Error("Google did not return an OAuth access token.");
    return accessToken;
}

async function getGoogleCredential(): Promise<AuthCredential> {
    return GoogleAuthProvider.credential(null, await getGoogleAccessToken());
}

async function getBridgeCredential(provider: "apple" | "facebook"): Promise<AuthCredential> {
    const credential = OAuthCredential.fromJSON(await getFederatedCredential(provider));
    if (!credential || credential.providerId !== `${provider}.com`) {
        throw new Error("The login provider returned the wrong credential type.");
    }
    return credential;
}

type ProviderAdapter = (provider: AccountProvider) => Promise<AuthCredential>;

const PROVIDER_ADAPTERS = {
    "chrome-identity": async provider => {
        if (provider !== "google") throw new Error("Invalid Chrome Identity provider.");
        return getGoogleCredential();
    },
    "federated-bridge": async provider => {
        if (provider === "google") throw new Error("Invalid federated bridge provider.");
        return getBridgeCredential(provider);
    },
} satisfies Record<ProviderTransport, ProviderAdapter>;

export function getProviderCredential(provider: AccountProvider): Promise<AuthCredential> {
    return PROVIDER_ADAPTERS[ACCOUNT_PROVIDER_TRANSPORTS[provider]](provider);
}
