import { browser } from "wxt/browser";
import {
    isAuthResponse,
    isTabAuthResult,
    type AuthResponse,
    type OffscreenAuthRequest,
} from "@extra-domain-filters/shared/authMessages";
import {
    getBundledAuthRuntime,
    isAllowedExtensionOrigin,
    type FederatedAuthProvider,
} from "@extra-domain-filters/shared/config/auth";

const OFFSCREEN_PATH = "/offscreen.html";
const TAB_FLOW_TIMEOUT_MS = 5 * 60_000;
const KEEP_ALIVE_MS = 20_000;
const { bridgeUrl, mode } = getBundledAuthRuntime();
let creatingDocument: Promise<void> | undefined;
let activeFlow: Promise<Record<string, unknown>> | undefined;

export class AuthBridgeError extends Error {
    constructor(message: string, readonly code?: string) {
        super(message);
        this.name = "AuthBridgeError";
    }
}

async function hasOffscreenDocument(): Promise<boolean> {
    const url = browser.runtime.getURL(OFFSCREEN_PATH);
    const contexts = await browser.runtime.getContexts({
        contextTypes: [browser.runtime.ContextType.OFFSCREEN_DOCUMENT],
        documentUrls: [url],
    });
    return contexts.length > 0;
}

async function ensureOffscreenDocument(): Promise<void> {
    if (await hasOffscreenDocument()) return;
    creatingDocument ??= browser.offscreen.createDocument({
        justification: `Complete federated authentication through ${new URL(bridgeUrl).host}.`,
        reasons: [browser.offscreen.Reason.IFRAME_SCRIPTING],
        url: OFFSCREEN_PATH,
    }).finally(() => {
        creatingDocument = undefined;
    });
    await creatingDocument;
}

async function closeOffscreenDocument(): Promise<void> {
    if (await hasOffscreenDocument()) await browser.offscreen.closeDocument();
}

async function runFlow(provider: FederatedAuthProvider): Promise<Record<string, unknown>> {
    await ensureOffscreenDocument();
    const request: OffscreenAuthRequest = {
        provider,
        requestId: crypto.randomUUID(),
        target: "offscreen-auth",
        type: "federated-auth:start",
    };
    try {
        const response: unknown = await browser.runtime.sendMessage(request);
        if (!isAuthResponse(response) || response.requestId !== request.requestId) {
            throw new Error("The hosted authentication page returned an invalid response.");
        }
        if (!response.ok) throw new AuthBridgeError(response.message, response.code);
        return response.credential;
    } finally {
        await closeOffscreenDocument().catch(() => undefined);
    }
}

/**
 * Sign-in in a tab, for every browser: the hosted page opens in a tab, you click the provider,
 * and the extension's content script on that page (entrypoints/auth-bridge.content.ts) relays
 * the result here. `state` ties the answer to this tab.
 */
async function runTabFlow(provider: FederatedAuthProvider): Promise<Record<string, unknown>> {
    const state = crypto.randomUUID();
    const url = new URL(bridgeUrl);
    url.searchParams.set("flow", "tab");
    url.searchParams.set("provider", provider);
    url.searchParams.set("state", state);
    const tab = await browser.tabs.create({ url: url.href });
    // Chromium stops an idle service worker after 30 seconds; an API call every 20 keeps this
    // one waiting for as long as the sign-in takes.
    const keepAlive = setInterval(() => void browser.runtime.getPlatformInfo(), KEEP_ALIVE_MS);
    try {
        const response = await new Promise<AuthResponse>((resolve, reject) => {
            const finish = (settle: () => void): void => {
                clearTimeout(timer);
                browser.runtime.onMessage.removeListener(onMessage);
                browser.tabs.onRemoved.removeListener(onRemoved);
                settle();
            };
            const onMessage = (message: unknown, sender: { tab?: { id?: number } }): undefined => {
                if (isTabAuthResult(message) && message.response.requestId === state && sender.tab?.id === tab.id) {
                    finish(() => resolve(message.response));
                }
                return undefined;
            };
            const onRemoved = (tabId: number): void => {
                if (tabId !== tab.id) return;
                finish(() => reject(new AuthBridgeError(
                    "The sign-in tab was closed before sign-in finished.",
                    "auth/popup-closed-by-user",
                )));
            };
            const timer = setTimeout(() => finish(() => reject(new AuthBridgeError("Sign-in timed out. Please try again."))), TAB_FLOW_TIMEOUT_MS);
            browser.runtime.onMessage.addListener(onMessage);
            browser.tabs.onRemoved.addListener(onRemoved);
        });
        if (!response.ok) throw new AuthBridgeError(response.message, response.code);
        return response.credential;
    } finally {
        clearInterval(keepAlive);
        if (tab.id !== undefined) await browser.tabs.remove(tab.id).catch(() => undefined);
    }
}

/**
 * One click in an offscreen document where it can work (Chromium with an extension ID the
 * sign-in page knows), otherwise the sign-in tab.
 */
function canUseOffscreen(): boolean {
    return browser.offscreen !== undefined
        && isAllowedExtensionOrigin(new URL(browser.runtime.getURL("/popup.html")).origin, mode);
}

export function getAuthBridgeCredential(provider: FederatedAuthProvider): Promise<Record<string, unknown>> {
    if (activeFlow) throw new Error("Another login is already in progress.");
    activeFlow = (canUseOffscreen() ? runFlow(provider) : runTabFlow(provider)).finally(() => {
        activeFlow = undefined;
    });
    return activeFlow;
}
