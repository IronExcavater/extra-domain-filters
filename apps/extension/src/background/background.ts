import { onMessage } from "../platform/messaging";
import {
    applyDomainAlertFromExtensionPage,
    removeDomainSavedSearchFromExtensionPage,
    syncDomainSavedSearchesFromExtensionPage,
} from "../platform/domainPageClient";
import {
    getAccountState,
    loginWithProvider,
    resetPassword,
    signInWithEmail,
    signOut,
    signUpWithEmail,
} from "./account";
import { startBlacklistSync } from "./blacklistSync";
import { enqueueListingEnrichment, startListingEnrichment } from "./listingEnrichment";
import { startSavedSearchSync } from "./savedSearchSync";
import { startSettingsSync } from "./settingsSync";
import { createSharedSearch, getSharedSearch } from "./sharedSearches";
import { startTelemetry, trackTelemetry } from "./telemetry";

startBlacklistSync();
startListingEnrichment();
startSettingsSync();
startSavedSearchSync();
startTelemetry();

onMessage("account:get", () => getAccountState());
onMessage("account:create-email", ({ email, password, displayName }) => signUpWithEmail(email, password, displayName));
onMessage("account:login-email", ({ email, password }) => signInWithEmail(email, password));
onMessage("account:login-provider", ({ provider }) => loginWithProvider(provider));
onMessage("account:reset-password", ({ email }) => resetPassword(email));
onMessage("account:sign-out", () => signOut());
onMessage("domain-alert:apply", ({ search, frequency }) =>
    applyDomainAlertFromExtensionPage(search, frequency));
onMessage("domain-saved-search:remove", ({ domainId }) =>
    removeDomainSavedSearchFromExtensionPage(domainId));
// The hidden Domain tabs these open are closed here, in the background: a popup can close (and
// stop running) before the tab is done with, which left it open.
onMessage("domain-saved-search:sync", () => syncDomainSavedSearchesFromExtensionPage());
onMessage("shared-search:create", ({ params }) => createSharedSearch(params));
onMessage("shared-search:get", ({ id }) => getSharedSearch(id));
onMessage("listing:enrich", ({ listings }) => enqueueListingEnrichment(listings));
onMessage("telemetry:track", ({ event }) => trackTelemetry(event));
