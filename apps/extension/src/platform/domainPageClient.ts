import type { SavedSearch, SearchNotificationFrequency } from "../domain/searches/savedSearches";
import { isDomainPageResult, type DomainPageResult } from "../site-dom/action";
import type { DomainAlertApplyMessage } from "../site-dom/alerts";
import type { DomainSavedSearchRemoveMessage } from "../site-dom/savedSearches";

const SAVED_SEARCHES_URL = "https://www.domain.com.au/user/saved-searches";

/** ~12s total budget (24 attempts × 500ms) for a background Domain tab to become ready. */
const MAX_TAB_READY_ATTEMPTS = 24;
const TAB_READY_POLL_INTERVAL_MS = 500;

function delay(milliseconds: number): Promise<void> {
    return new Promise(resolve => window.setTimeout(resolve, milliseconds));
}

async function sendToDomainPage(
    url: string,
    message: DomainAlertApplyMessage | DomainSavedSearchRemoveMessage,
): Promise<DomainPageResult> {
    const tab = await chrome.tabs.create({ active: false, url });
    if (tab.id === undefined) throw new Error("Could not open Domain to complete this change.");

    try {
        let lastError: unknown;
        for (let attempt = 0; attempt < MAX_TAB_READY_ATTEMPTS; attempt++) {
            try {
                const result: unknown = await chrome.tabs.sendMessage(tab.id, message);
                if (!isDomainPageResult(result)) {
                    throw new Error("Domain returned an invalid response.");
                }
                if (result.ok) return result;
                throw new Error(result.message);
            } catch (error) {
                lastError = error;
                if (error instanceof Error && !/receiving end does not exist|message port closed/i.test(error.message)) {
                    throw error;
                }
                await delay(TAB_READY_POLL_INTERVAL_MS);
            }
        }
        throw lastError instanceof Error
            ? lastError
            : new Error("Domain did not become ready to complete this change.");
    } finally {
        await chrome.tabs.remove(tab.id).catch(() => undefined);
    }
}

export async function applyDomainAlertFromExtensionPage(
    search: SavedSearch,
    frequency: SearchNotificationFrequency,
): Promise<void> {
    await sendToDomainPage(search.domainId ? SAVED_SEARCHES_URL : search.url, {
        domainId: search.domainId,
        frequency,
        type: "edf:domain-alert:apply",
    });
}

export async function removeDomainSavedSearchFromExtensionPage(domainId: string): Promise<void> {
    await sendToDomainPage(SAVED_SEARCHES_URL, {
        domainId,
        type: "edf:domain-saved-search:remove",
    });
}
