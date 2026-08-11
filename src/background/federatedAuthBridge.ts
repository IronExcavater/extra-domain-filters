import { getBundledFederatedAuthRuntime, type FederatedAuthProvider } from "../config/authRuntime";
import {
    isFederatedAuthResponse,
    type OffscreenAuthRequest,
} from "../shared/platform/authBridge";

const OFFSCREEN_PATH = "src/offscreen/offscreen.html";
const { bridgeUrl } = getBundledFederatedAuthRuntime();
let creatingDocument: Promise<void> | undefined;
let activeFlow: Promise<Record<string, unknown>> | undefined;

export class FederatedAuthError extends Error {
    constructor(message: string, readonly code?: string) {
        super(message);
        this.name = "FederatedAuthError";
    }
}

async function hasOffscreenDocument(): Promise<boolean> {
    const url = chrome.runtime.getURL(OFFSCREEN_PATH);
    const contexts = await chrome.runtime.getContexts({
        contextTypes: [chrome.runtime.ContextType.OFFSCREEN_DOCUMENT],
        documentUrls: [url],
    });
    return contexts.length > 0;
}

async function ensureOffscreenDocument(): Promise<void> {
    if (await hasOffscreenDocument()) return;
    creatingDocument ??= chrome.offscreen.createDocument({
        justification: `Complete Apple or Facebook authentication through ${new URL(bridgeUrl).host}.`,
        reasons: [chrome.offscreen.Reason.IFRAME_SCRIPTING],
        url: OFFSCREEN_PATH,
    }).finally(() => {
        creatingDocument = undefined;
    });
    await creatingDocument;
}

async function closeOffscreenDocument(): Promise<void> {
    if (await hasOffscreenDocument()) await chrome.offscreen.closeDocument();
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
        const response: unknown = await chrome.runtime.sendMessage(request);
        if (!isFederatedAuthResponse(response) || response.requestId !== request.requestId) {
            throw new Error("The hosted authentication page returned an invalid response.");
        }
        if (!response.ok) throw new FederatedAuthError(response.message, response.code);
        return response.credential;
    } finally {
        await closeOffscreenDocument().catch(() => undefined);
    }
}

export function getFederatedCredential(provider: FederatedAuthProvider): Promise<Record<string, unknown>> {
    if (activeFlow) throw new Error("Another login is already in progress.");
    activeFlow = runFlow(provider).finally(() => {
        activeFlow = undefined;
    });
    return activeFlow;
}
