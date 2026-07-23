import { sendExtensionRequest } from "../../shared/platform/messages";
import type { AccountState } from "./model";

export function getAccountState(): Promise<AccountState> {
    return sendExtensionRequest({ type: "account:get" });
}

export function signIn(): Promise<AccountState> {
    return sendExtensionRequest({ type: "account:sign-in" });
}

export function signOut(): Promise<AccountState> {
    return sendExtensionRequest({ type: "account:sign-out" });
}
