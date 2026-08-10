import {
    isFederatedAuthBridgeRequest,
    type FederatedAuthBridgeResponse,
} from "../shared/platform/authBridge";

const helperUrl = import.meta.env.VITE_FIREBASE_AUTH_HELPER_URL?.trim();
const iframe = document.createElement("iframe");
const loaded = new Promise<void>((resolve, reject) => {
    iframe.addEventListener("load", () => resolve(), { once: true });
    iframe.addEventListener("error", () => reject(new Error("Could not load the hosted authentication page.")), {
        once: true,
    });
});

if (helperUrl) {
    iframe.hidden = true;
    iframe.src = helperUrl;
    document.body.append(iframe);
}

chrome.runtime.onMessage.addListener((message: unknown, _sender, sendResponse) => {
    if (!isFederatedAuthBridgeRequest(message)) return false;
    if (!helperUrl) {
        sendResponse({
            message: "The hosted authentication page is not configured.",
            ok: false,
            requestId: message.requestId,
        } satisfies FederatedAuthBridgeResponse);
        return false;
    }
    const origin = new URL(helperUrl).origin;
    const timeout = window.setTimeout(() => {
        cleanup();
        sendResponse({
            message: "Login timed out. Please try again.",
            ok: false,
            requestId: message.requestId,
        } satisfies FederatedAuthBridgeResponse);
    }, 90_000);
    const onMessage = (event: MessageEvent<unknown>): void => {
        if (event.origin !== origin || event.source !== iframe.contentWindow) return;
        if (!event.data || typeof event.data !== "object") return;
        const response = event.data as Partial<FederatedAuthBridgeResponse>;
        if (response.requestId !== message.requestId) return;
        cleanup();
        sendResponse(event.data);
    };
    const cleanup = (): void => {
        window.clearTimeout(timeout);
        window.removeEventListener("message", onMessage);
    };
    window.addEventListener("message", onMessage);
    void loaded.then(() => iframe.contentWindow?.postMessage({
        provider: message.provider,
        requestId: message.requestId,
        type: "federated-auth:start",
    }, origin)).catch(error => {
        cleanup();
        sendResponse({
            message: error instanceof Error ? error.message : "Could not start login.",
            ok: false,
            requestId: message.requestId,
        } satisfies FederatedAuthBridgeResponse);
    });
    return true;
});
