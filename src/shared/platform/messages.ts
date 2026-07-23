import type { AccountState } from "../../domain/account/model";
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
    | { type: "account:sign-in" }
    | { type: "account:sign-out" }
    | { type: "shared-search:create"; params: string }
    | { type: "shared-search:get"; id: string }
    | { event: TelemetryEventInput; type: "telemetry:track" };

export type ExtensionResponse<T> =
    | { ok: true; value: T }
    | { error: string; ok: false };

export interface ExtensionResponseMap {
    "account:get": AccountState;
    "account:sign-in": AccountState;
    "account:sign-out": AccountState;
    "shared-search:create": SharedSearch;
    "shared-search:get": SharedSearch | undefined;
    "telemetry:track": undefined;
}

type RequestValidator = (value: Record<string, unknown>) => boolean;

const REQUEST_VALIDATORS = {
    "account:get": () => true,
    "account:sign-in": () => true,
    "account:sign-out": () => true,
    "shared-search:create": isCreateSharedSearchInput,
    "shared-search:get": value => isSharedSearchId(value.id),
    "telemetry:track": value => isTelemetryEventInput(value.event),
} satisfies Record<ExtensionRequest["type"], RequestValidator>;

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
