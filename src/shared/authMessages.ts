import type { FederatedAuthProvider } from "./config/auth";

// Local copy of utils/types.ts's isPlainObject — kept here rather than imported
// so this cross-app file has no dependency on extension-only code.
function isPlainObject(value: unknown): value is Record<string, unknown> {
    return typeof value === "object" && value !== null && !Array.isArray(value);
}

export interface OffscreenAuthRequest {
    provider: FederatedAuthProvider;
    requestId: string;
    target: "offscreen-auth";
    type: "federated-auth:start";
}

export interface FederatedAuthPageRequest {
    provider: FederatedAuthProvider;
    requestId: string;
    type: "federated-auth:start";
}

export type FederatedAuthResponse =
    | { credential: Record<string, unknown>; ok: true; requestId: string }
    | { code?: string; message: string; ok: false; requestId: string };

export function isFederatedAuthProvider(value: unknown): value is FederatedAuthProvider {
    return value === "apple" || value === "facebook";
}

function isRequest(value: unknown): value is FederatedAuthPageRequest {
    return isPlainObject(value)
        && value.type === "federated-auth:start"
        && typeof value.requestId === "string"
        && value.requestId.length > 0
        && isFederatedAuthProvider(value.provider);
}

export function isOffscreenAuthRequest(value: unknown): value is OffscreenAuthRequest {
    return isRequest(value) && isPlainObject(value) && value.target === "offscreen-auth";
}

export function isFederatedAuthPageRequest(value: unknown): value is FederatedAuthPageRequest {
    return isRequest(value) && !("target" in value);
}

export function isFederatedAuthResponse(value: unknown): value is FederatedAuthResponse {
    if (!isPlainObject(value)
        || typeof value.ok !== "boolean"
        || typeof value.requestId !== "string"
        || value.requestId.length === 0) return false;
    return value.ok
        ? isPlainObject(value.credential)
        : typeof value.message === "string" && (value.code === undefined || typeof value.code === "string");
}
