import { defineExtensionMessaging } from "@webext-core/messaging";
import type { AccountProvider, AccountState } from "../domain/account/model";
import type { ListingSnapshot } from "../domain/matching";
import {
    normalizeSavedSearch,
    type SavedSearch,
    type SearchNotificationFrequency,
} from "../domain/searches/savedSearches";
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
    "domain-alert:apply": (data: {
        frequency: SearchNotificationFrequency;
        search: SavedSearch;
    }) => void;
    "domain-saved-search:remove": (data: { domainId: string }) => void;
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
    "domain-alert:apply": value => isDomainAlertRequest(value),
    "domain-saved-search:remove": value => typeof value.domainId === "string"
        && value.domainId.length > 0 && value.domainId.length <= 200,
    "shared-search:create": isCreateSharedSearchInput,
    "shared-search:get": value => isSharedSearchId(value.id),
    "listing:enrich": value => Array.isArray(value.listings) && value.listings.length <= 24 &&
        value.listings.every(listing => isPlainObject(listing) && typeof listing.url === "string" &&
            typeof listing.title === "string" && typeof listing.text === "string"),
    "telemetry:track": value => isTelemetryEventInput(value.event),
} satisfies Record<keyof ExtensionProtocolMap, RequestValidator>;

function isDomainAlertRequest(value: Record<string, unknown>): boolean {
    const search = normalizeSavedSearch(value.search);
    if (!search || !["daily", "none", "weekly"].includes(String(value.frequency))) return false;
    try {
        const hostname = new URL(search.url).hostname;
        return hostname === "domain.com.au" || hostname === "www.domain.com.au";
    } catch {
        return false;
    }
}

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
