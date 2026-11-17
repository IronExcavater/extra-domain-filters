import { browser } from "wxt/browser";
import {
    isAuthBridgeReady,
    isAuthResponse,
    isOffscreenAuthRequest,
    type AuthPageRequest,
    type AuthResponse,
} from "@extra-domain-filters/shared/authMessages";
import { getBundledAuthRuntime } from "@extra-domain-filters/shared/config/auth";

const LOGIN_TIMEOUT_MS = 90_000;
const BRIDGE_READY_TIMEOUT_MS = 10_000;

const { bridgeOrigin, bridgeUrl, mode } = getBundledAuthRuntime();
const iframe = document.createElement("iframe");
// An iframe fires "load" even for an error page, so wait for the page itself to say it is
// listening. Without that, a missing or unreachable auth page used to hang for 90 seconds.
const ready = new Promise<void>((resolve, reject) => {
    const timer = window.setTimeout(() => {
        window.removeEventListener("message", onReady);
        reject(new Error(mode === "development"
            ? `Couldn't reach the sign-in page at ${new URL(bridgeUrl).host}. Start it with "pnpm dev".`
            : "Couldn't reach the sign-in service. Check your connection and try again."));
    }, BRIDGE_READY_TIMEOUT_MS);
    const onReady = (event: MessageEvent<unknown>): void => {
        if (event.origin !== bridgeOrigin || event.source !== iframe.contentWindow || !isAuthBridgeReady(event.data)) return;
        window.clearTimeout(timer);
        window.removeEventListener("message", onReady);
        resolve();
    };
    window.addEventListener("message", onReady);
});
ready.catch(() => undefined);

iframe.hidden = true;
iframe.src = bridgeUrl;
document.body.append(iframe);

browser.runtime.onMessage.addListener((message: unknown, _sender, sendResponse) => {
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
    void ready.then(() => {
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
