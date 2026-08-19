import { sendExtensionMessage } from "../../platform/messaging";
import type { AccountProvider, AccountState } from "./model";

export function getAccountState(): Promise<AccountState> {
    return sendExtensionMessage("account:get", undefined);
}

export function loginWithProvider(provider: AccountProvider): Promise<AccountState> {
    return sendExtensionMessage("account:login-provider", { provider });
}

export function loginWithEmail(email: string, password: string): Promise<AccountState> {
    return sendExtensionMessage("account:login-email", { email, password });
}

export function createEmailAccount(email: string, password: string, displayName?: string): Promise<AccountState> {
    return sendExtensionMessage("account:create-email", { displayName, email, password });
}

export function requestPasswordReset(email: string): Promise<void> {
    return sendExtensionMessage("account:reset-password", { email });
}

export function signOut(): Promise<AccountState> {
    return sendExtensionMessage("account:sign-out", undefined);
}
