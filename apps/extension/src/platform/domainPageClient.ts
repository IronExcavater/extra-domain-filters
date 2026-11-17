import type { SavedSearch, SearchNotificationFrequency } from "../domain/searches/savedSearches";
import { isDomainPageResult, type DomainPageResult } from "../site-dom/action";
import { getFromStorage, setInStorage } from "./storage";
import type { DomainAlertApplyMessage } from "../site-dom/alerts";
import type {
    DomainSavedSearchRemoveMessage,
    DomainSavedSearchSyncMessage,
} from "../site-dom/savedSearches";

const SAVED_SEARCHES_URL = "https://www.domain.com.au/user/saved-searches";

/** ~12s total budget (24 attempts × 500ms) for a background Domain tab to become ready. */
const MAX_TAB_READY_ATTEMPTS = 24;
const TAB_READY_POLL_INTERVAL_MS = 500;

export interface DomainSessionState {
    /** When Domain was last checked; the popup only opens a hidden Domain tab when stale. */
    checkedAt?: number;
    count?: number;
    status: "signed-in" | "signed-out" | "unavailable";
}

const SESSION_KEY = "domainSession";
const SIGNED_IN_TTL_MS = 30 * 60_000;
const RETRY_TTL_MS = 10 * 60_000;

export async function getDomainSession(): Promise<DomainSessionState> {
    return (await getFromStorage<DomainSessionState>(SESSION_KEY)) ?? { status: "unavailable" };
}

export function isDomainSessionStale(session: DomainSessionState, now = Date.now()): boolean {
    const ttl = session.status === "signed-in" ? SIGNED_IN_TTL_MS : RETRY_TTL_MS;
    return session.checkedAt === undefined || now - session.checkedAt >= ttl;
}

class DomainSignedOutError extends Error {}

function delay(milliseconds: number): Promise<void> {
    return new Promise(resolve => globalThis.setTimeout(resolve, milliseconds));
}

async function sendToDomainPage(
    url: string,
    message: DomainAlertApplyMessage | DomainSavedSearchRemoveMessage | DomainSavedSearchSyncMessage,
): Promise<DomainPageResult> {
    const tab = await chrome.tabs.create({ active: false, url });
    if (tab.id === undefined) throw new Error("Could not open Domain to complete this change.");

    try {
        let lastError: unknown;
        for (let attempt = 0; attempt < MAX_TAB_READY_ATTEMPTS; attempt++) {
            const currentTab = await chrome.tabs.get(tab.id).catch(() => undefined);
            const currentUrl = currentTab?.url ?? currentTab?.pendingUrl;
            if (currentUrl && new URL(currentUrl).hostname === "auth.domain.com.au") {
                throw new DomainSignedOutError("Sign in to Domain to sync saved searches.");
            }
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

async function checkDomainSession(): Promise<DomainSessionState> {
    try {
        const result = await sendToDomainPage(SAVED_SEARCHES_URL, {
            type: "edf:domain-saved-search:sync",
        });
        const count = result.ok
            ? (result as unknown as { count?: unknown }).count
            : undefined;
        return {
            count: typeof count === "number" ? count : undefined,
            status: "signed-in",
        };
    } catch (error) {
        return { status: error instanceof DomainSignedOutError ? "signed-out" : "unavailable" };
    }
}

/** Syncs saved searches through a hidden Domain tab and remembers the outcome. */
export async function syncDomainSavedSearchesFromExtensionPage(): Promise<DomainSessionState> {
    const session = { ...await checkDomainSession(), checkedAt: Date.now() };
    await setInStorage(SESSION_KEY, session);
    return session;
}
