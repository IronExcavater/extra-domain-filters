import { isTabAuthResult } from "@extra-domain-filters/shared/authMessages";
import { browser } from "wxt/browser";
import { defineContentScript } from "wxt/utils/define-content-script";

/**
 * On the hosted sign-in page in a tab (background/authBridge.ts runTabFlow): the page posts
 * its result to its own window, and this relays it to the background. Only this extension's
 * content script runs here, so the result reaches no other extension's background.
 * The match is the production page; wxt.config.ts points dev builds at the local one.
 */
export default defineContentScript({
    matches: ["https://extra-domain-filters.web.app/auth/*"],
    runAt: "document_start",
    main() {
        window.addEventListener("message", event => {
            if (event.source !== window || event.origin !== window.location.origin || !isTabAuthResult(event.data)) return;
            void browser.runtime.sendMessage(event.data);
        });
    },
});
