import {
    isExtensionRequest,
    type ExtensionRequest,
    type ExtensionResponse,
} from "../shared/platform/messages";
import { getAccountState, signIn, signOut } from "./account";
import { startBlacklistSync } from "./blacklistSync";
import { startSavedSearchSync } from "./savedSearchSync";
import { startSettingsSync } from "./settingsSync";
import { createSharedSearch, getSharedSearch } from "./sharedSearches";
import { startTelemetry, trackTelemetry } from "./telemetry";

startBlacklistSync();
startSettingsSync();
startSavedSearchSync();
startTelemetry();

async function handleRequest(request: ExtensionRequest): Promise<unknown> {
    switch (request.type) {
        case "account:get": return getAccountState();
        case "account:sign-in": return signIn();
        case "account:sign-out": return signOut();
        case "shared-search:create": return createSharedSearch(request.params);
        case "shared-search:get": return getSharedSearch(request.id);
        case "telemetry:track": return trackTelemetry(request.event);
    }
}

chrome.runtime.onMessage.addListener((request: unknown, _sender, respond) => {
    if (!isExtensionRequest(request)) return false;

    void handleRequest(request)
        .then(value => respond({ ok: true, value } satisfies ExtensionResponse<unknown>))
        .catch((error: unknown) => respond({
            ok: false,
            error: error instanceof Error ? error.message : "Unexpected extension error.",
        } satisfies ExtensionResponse<unknown>));

    return true;
});
