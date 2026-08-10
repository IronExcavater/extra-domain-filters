import type { AccountProvider } from "../../domain/account/model";
import { isPlainObject } from "../utils/types";

export type FederatedAccountProvider = Exclude<AccountProvider, "google">;

export interface FederatedAuthBridgeRequest {
    provider: FederatedAccountProvider;
    requestId: string;
    target: "offscreen-auth";
    type: "federated-auth:start";
}

export type FederatedAuthBridgeResponse =
    | { credential: Record<string, unknown>; ok: true; requestId: string }
    | { code?: string; message: string; ok: false; requestId: string };

export function isFederatedAuthBridgeRequest(value: unknown): value is FederatedAuthBridgeRequest {
    return isPlainObject(value)
        && value.target === "offscreen-auth"
        && value.type === "federated-auth:start"
        && typeof value.requestId === "string"
        && (value.provider === "apple" || value.provider === "facebook");
}

export function isFederatedAuthBridgeResponse(value: unknown): value is FederatedAuthBridgeResponse {
    if (!isPlainObject(value) || typeof value.ok !== "boolean" || typeof value.requestId !== "string") return false;
    return value.ok
        ? isPlainObject(value.credential)
        : typeof value.message === "string" && (value.code === undefined || typeof value.code === "string");
}
