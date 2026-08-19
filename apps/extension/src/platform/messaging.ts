import { defineExtensionMessaging } from "@webext-core/messaging";
import type { AccountProvider, AccountState } from "../domain/account/model";
import type { ListingSnapshot } from "../domain/matching";
import {
    isCreateSharedSearchInput,
    isSharedSearchId,
    type SharedSearch,
} from "../domain/searches/model";
import { isTelemetryEventInput, type TelemetryEventInput } from "../domain/telemetry/model";
import { isPlainObject } from "../utils/types";
import { isExtensionContextUnavailable } from "./storage";

export interface ExtensionProtocolMap {
    "account:get": () => AccountState;
    "account:create-email": (data: { displayName?: string; email: string; password: string }) => AccountState;
    "account:login-email": (data: { email: string; password: string }) => AccountState;
    "account:login-provider": (data: { provider: AccountProvider }) => AccountState;
    "account:reset-password": (data: { email: string }) => void;
    "account:sign-out": () => AccountState;
    "shared-search:create": (data: { params: string }) => SharedSearch;
    "shared-search:get": (data: { id: string }) => SharedSearch | undefined;
    "listing:enrich": (data: { listings: ListingSnapshot[] }) => void;
    "telemetry:track": (data: { event: TelemetryEventInput }) => void;
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
} satisfies Record<keyof ExtensionProtocolMap, RequestValidator>;

function isEmail(value: unknown): boolean {
    return typeof value === "string" && value.length > 2 && value.length <= 320;
}

function isPassword(value: unknown): boolean {
    return typeof value === "string" && value.length > 0 && value.length <= 4096;
}

const messenger = defineExtensionMessaging<ExtensionProtocolMap>();

export function onMessage<K extends keyof ExtensionProtocolMap>(
    type: K,
    handler: (data: Parameters<ExtensionProtocolMap[K]>[0]) => ReturnType<ExtensionProtocolMap[K]> | Promise<ReturnType<ExtensionProtocolMap[K]>>,
): ReturnType<typeof messenger.onMessage> {
    return messenger.onMessage(type, message => {
        const data = (message.data ?? {}) as Record<string, unknown>;
        if (!REQUEST_VALIDATORS[type](data)) throw new Error(`Invalid payload for message "${String(type)}".`);
        return handler(message.data as Parameters<ExtensionProtocolMap[K]>[0]);
    });
}

export async function sendExtensionMessage<K extends keyof ExtensionProtocolMap>(
    type: K,
    data: Parameters<ExtensionProtocolMap[K]>[0],
): Promise<ReturnType<ExtensionProtocolMap[K]>> {
    try {
        return await messenger.sendMessage(type, data as never);
    } catch (error) {
        if (isExtensionContextUnavailable(error)) {
            throw new Error("Extension context is no longer available. Reload the page after reloading the extension.");
        }
        throw error;
    }
}
