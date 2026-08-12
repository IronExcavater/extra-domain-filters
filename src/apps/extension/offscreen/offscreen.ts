import {
    isAuthResponse,
    isOffscreenAuthRequest,
    type AuthPageRequest,
    type AuthResponse,
} from "@shared/authMessages";
import { getBundledAuthRuntime } from "@shared/config/auth";

const LOGIN_TIMEOUT_MS = 90_000;

const { bridgeOrigin, bridgeUrl } = getBundledAuthRuntime();
const iframe = document.createElement("iframe");
const loaded = new Promise<void>((resolve, reject) => {
    iframe.addEventListener("load", () => resolve(), { once: true });
    iframe.addEventListener("error", () => reject(new Error("Could not load the hosted authentication page.")), {
        once: true,
    });
});

iframe.hidden = true;
iframe.src = bridgeUrl;
document.body.append(iframe);

chrome.runtime.onMessage.addListener((message: unknown, _sender, sendResponse) => {
    if (!isOffscreenAuthRequest(message)) return false;
    let settled = false;
    let timeout = 0;
    const cleanup = (): void => {
        window.clearTimeout(timeout);
        window.removeEventListener("message", onMessage);
    };
    const respond = (response: AuthResponse): void => {
        if (settled) return;
        settled = true;
        cleanup();
        sendResponse(response);
    };
    const onMessage = (event: MessageEvent<unknown>): void => {
        if (event.origin !== bridgeOrigin
            || event.source !== iframe.contentWindow
            || !isAuthResponse(event.data)
            || event.data.requestId !== message.requestId) return;
        respond(event.data);
    };
    timeout = window.setTimeout(() => respond({
        message: "Login timed out. Please try again.",
        ok: false,
        requestId: message.requestId,
    }), LOGIN_TIMEOUT_MS);
    window.addEventListener("message", onMessage);
    void loaded.then(() => {
        const request: AuthPageRequest = {
            provider: message.provider,
            requestId: message.requestId,
            type: "federated-auth:start",
        };
        iframe.contentWindow?.postMessage(request, bridgeOrigin);
    }).catch(error => {
        respond({
            message: error instanceof Error ? error.message : "Could not start login.",
            ok: false,
            requestId: message.requestId,
        });
    });
    return true;
});
