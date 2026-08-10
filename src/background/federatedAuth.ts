import { readFederatedAuthHelperUrl } from "../infrastructure/firebase/config";
import {
    isFederatedAuthBridgeResponse,
    type FederatedAccountProvider,
    type FederatedAuthBridgeRequest,
} from "../shared/platform/authBridge";

const OFFSCREEN_PATH = "src/offscreen/offscreen.html";
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
        justification: "Complete Apple or Facebook authentication in Firebase's hosted sign-in page.",
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

async function runFlow(provider: FederatedAccountProvider): Promise<Record<string, unknown>> {
    if (!readFederatedAuthHelperUrl()) {
        throw new Error("Apple and Facebook login are not configured for this extension build.");
    }
    await ensureOffscreenDocument();
    const request: FederatedAuthBridgeRequest = {
        provider,
        requestId: crypto.randomUUID(),
        target: "offscreen-auth",
        type: "federated-auth:start",
    };
    try {
        const response: unknown = await chrome.runtime.sendMessage(request);
        if (!isFederatedAuthBridgeResponse(response) || response.requestId !== request.requestId) {
            throw new Error("The hosted authentication page returned an invalid response.");
        }
        if (!response.ok) throw new FederatedAuthError(response.message, response.code);
        return response.credential;
    } finally {
        await closeOffscreenDocument().catch(() => undefined);
    }
}

export function getFederatedCredential(provider: FederatedAccountProvider): Promise<Record<string, unknown>> {
    if (activeFlow) throw new Error("Another login is already in progress.");
    activeFlow = runFlow(provider).finally(() => {
        activeFlow = undefined;
    });
    return activeFlow;
}
