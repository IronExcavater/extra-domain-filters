import { OAuthCredential, type AuthCredential } from "firebase/auth/web-extension";

import {
    ACCOUNT_PROVIDER_TRANSPORTS,
    type AccountProvider,
    type ProviderTransport,
} from "../domain/account/model";
import { getAuthBridgeCredential } from "./authBridge";

async function getBridgeCredential(provider: AccountProvider): Promise<AuthCredential> {
    const credential = OAuthCredential.fromJSON(await getAuthBridgeCredential(provider));
    if (!credential || credential.providerId !== `${provider}.com`) {
        throw new Error("The login provider returned the wrong credential type.");
    }
    return credential;
}

type ProviderAdapter = (provider: AccountProvider) => Promise<AuthCredential>;

const PROVIDER_ADAPTERS = {
    "federated-bridge": getBridgeCredential,
} satisfies Record<ProviderTransport, ProviderAdapter>;

export function getProviderCredential(provider: AccountProvider): Promise<AuthCredential> {
    return PROVIDER_ADAPTERS[ACCOUNT_PROVIDER_TRANSPORTS[provider]](provider);
}
