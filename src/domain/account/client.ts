import { sendExtensionRequest } from "../../shared/platform/messages";
import type { AccountProvider, AccountState } from "./model";

export function getAccountState(): Promise<AccountState> {
    return sendExtensionRequest({ type: "account:get" });
}

export function loginWithProvider(provider: AccountProvider): Promise<AccountState> {
    return sendExtensionRequest({ provider, type: "account:login-provider" });
}

export function loginWithEmail(email: string, password: string): Promise<AccountState> {
    return sendExtensionRequest({ email, password, type: "account:login-email" });
}

export function createEmailAccount(email: string, password: string, displayName?: string): Promise<AccountState> {
    return sendExtensionRequest({ displayName, email, password, type: "account:create-email" });
}

export function requestPasswordReset(email: string): Promise<void> {
    return sendExtensionRequest({ email, type: "account:reset-password" });
}

export function signOut(): Promise<AccountState> {
    return sendExtensionRequest({ type: "account:sign-out" });
}
