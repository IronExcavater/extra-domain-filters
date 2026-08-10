import type { AccountProvider, AccountState } from "../../domain/account/model";
import type { ListingSnapshot } from "../../domain/matching";
import {
    isCreateSharedSearchInput,
    isSharedSearchId,
    type SharedSearch,
} from "../../domain/searches/model";
import { isTelemetryEventInput, type TelemetryEventInput } from "../../domain/telemetry/model";
import { isPlainObject } from "../utils/types";
import { isExtensionContextUnavailable } from "./storage";

export type ExtensionRequest =
    | { type: "account:get" }
    | { displayName?: string; email: string; password: string; type: "account:create-email" }
    | { provider: AccountProvider; type: "account:login-provider" }
    | { email: string; password: string; type: "account:login-email" }
    | { email: string; type: "account:reset-password" }
    | { type: "account:sign-out" }
    | { type: "shared-search:create"; params: string }
    | { type: "shared-search:get"; id: string }
    | { listings: ListingSnapshot[]; type: "listing:enrich" }
    | { event: TelemetryEventInput; type: "telemetry:track" };

export type ExtensionResponse<T> =
    | { ok: true; value: T }
    | { error: string; ok: false };

export interface ExtensionResponseMap {
    "account:get": AccountState;
    "account:create-email": AccountState;
    "account:login-email": AccountState;
    "account:login-provider": AccountState;
    "account:reset-password": undefined;
    "account:sign-out": AccountState;
    "shared-search:create": SharedSearch;
    "shared-search:get": SharedSearch | undefined;
    "listing:enrich": undefined;
    "telemetry:track": undefined;
}

type RequestValidator = (value: Record<string, unknown>) => boolean;

const REQUEST_VALIDATORS = {
    "account:get": () => true,
    "account:create-email": value => isEmail(value.email) && isPassword(value.password)
        && (value.displayName === undefined || typeof value.displayName === "string" && value.displayName.length <= 100),
    "account:login-email": value => isEmail(value.email) && isPassword(value.password),
    "account:login-provider": value => value.provider === "apple"
        || value.provider === "facebook"
        || value.provider === "google",
    "account:reset-password": value => isEmail(value.email),
    "account:sign-out": () => true,
    "shared-search:create": isCreateSharedSearchInput,
    "shared-search:get": value => isSharedSearchId(value.id),
    "listing:enrich": value => Array.isArray(value.listings) && value.listings.length <= 24 &&
        value.listings.every(listing => isPlainObject(listing) && typeof listing.url === "string" &&
            typeof listing.title === "string" && typeof listing.text === "string"),
    "telemetry:track": value => isTelemetryEventInput(value.event),
} satisfies Record<ExtensionRequest["type"], RequestValidator>;

function isEmail(value: unknown): boolean {
    return typeof value === "string" && value.length > 2 && value.length <= 320;
}

function isPassword(value: unknown): boolean {
    return typeof value === "string" && value.length > 0 && value.length <= 4096;
}

function isExtensionRequestType(value: unknown): value is ExtensionRequest["type"] {
    return typeof value === "string" && value in REQUEST_VALIDATORS;
}

export function isExtensionRequest(value: unknown): value is ExtensionRequest {
    if (!isPlainObject(value) || !isExtensionRequestType(value.type)) return false;
    return REQUEST_VALIDATORS[value.type](value);
}

export async function sendExtensionRequest<T extends ExtensionRequest["type"]>(
    request: Extract<ExtensionRequest, { type: T }>,
): Promise<ExtensionResponseMap[T]> {
    let response: ExtensionResponse<ExtensionResponseMap[T]> | undefined;
    try {
        response = await chrome.runtime.sendMessage<
            Extract<ExtensionRequest, { type: T }>,
            ExtensionResponse<ExtensionResponseMap[T]> | undefined
        >(request);
    } catch (error) {
        if (isExtensionContextUnavailable(error)) {
            throw new Error("Extension context is no longer available. Reload the page after reloading the extension.");
        }
        throw error;
    }

    if (!response) throw new Error("Extension background service did not respond.");
    if (!response.ok) throw new Error(response.error);
    return response.value;
}
