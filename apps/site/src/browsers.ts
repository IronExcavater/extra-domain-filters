import chromeLogo from "@browser-logos/chrome/chrome.svg?url";
import edgeLogo from "@browser-logos/edge/edge.svg?url";
import firefoxLogo from "@browser-logos/firefox/firefox.svg?url";
import operaLogo from "@browser-logos/opera/opera.svg?url";
import safariLogo from "@browser-logos/safari/safari.svg?url";
import { STORE_LINKS, type StoreBrowser } from "@extra-domain-filters/shared/config/links";

export interface BrowserInfo {
    id: StoreBrowser;
    /** The install button: "Add to Edge". */
    action: string;
    href: string;
    logo: string;
    name: string;
    store: string;
}

// The browsers' own logos, from the browser-logos packages (github.com/alrra/browser-logos).
const LOGOS: Record<StoreBrowser, string> = {
    chrome: chromeLogo,
    edge: edgeLogo,
    firefox: firefoxLogo,
    opera: operaLogo,
    safari: safariLogo,
};

function logo(id: StoreBrowser): string {
    return `<img src="${LOGOS[id]}" alt="" width="48" height="48" decoding="async">`;
}

export const BROWSERS: readonly BrowserInfo[] = [
    { id: "chrome", action: "Add to Chrome", href: STORE_LINKS.chrome, logo: logo("chrome"), name: "Chrome", store: "Chrome Web Store" },
    { id: "edge", action: "Add to Edge", href: STORE_LINKS.edge, logo: logo("edge"), name: "Edge", store: "Edge Add-ons" },
    { id: "firefox", action: "Add to Firefox", href: STORE_LINKS.firefox, logo: logo("firefox"), name: "Firefox", store: "Firefox Add-ons" },
    { id: "opera", action: "Add to Opera", href: STORE_LINKS.opera, logo: logo("opera"), name: "Opera", store: "Opera add-ons" },
    { id: "safari", action: "Get it for Safari", href: STORE_LINKS.safari, logo: logo("safari"), name: "Safari", store: "Build for Mac" },
];

/** The browser this page is open in, so the install button can name it. Chrome otherwise. */
export function detectBrowser(userAgent = navigator.userAgent): BrowserInfo {
    const id: StoreBrowser = /Edg\//.test(userAgent) ? "edge"
        : /OPR\/|Opera/.test(userAgent) ? "opera"
        : /Firefox\//.test(userAgent) ? "firefox"
        : /Safari\//.test(userAgent) && !/Chrome|Chromium|CriOS|Android/.test(userAgent) ? "safari"
        : "chrome";
    return BROWSERS.find(browser => browser.id === id) ?? BROWSERS[0];
}

/** The green install button for the visitor's browser. */
export function installButton(browser: BrowserInfo, className = "site-button"): string {
    return `<a class="${className}" href="${browser.href}" target="_blank" rel="noopener noreferrer">
        <span class="site-button-logo">${browser.logo}</span>${browser.action}<span class="site-button-free">Free</span></a>`;
}
