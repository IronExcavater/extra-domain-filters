import braveLogo from "@browser-logos/brave/brave.svg?url";
import chromeLogo from "@browser-logos/chrome/chrome.svg?url";
import edgeLogo from "@browser-logos/edge/edge.svg?url";
import firefoxLogo from "@browser-logos/firefox/firefox.svg?url";
import operaGxLogo from "@browser-logos/opera-gx/opera-gx.svg?url";
import operaLogo from "@browser-logos/opera/opera.svg?url";
import safariLogo from "@browser-logos/safari-ios/safari-ios.svg?url";
import vivaldiLogo from "@browser-logos/vivaldi/vivaldi.svg?url";
import externalSvg from "../../../packages/assets/icons/actions/external.svg?raw";
import { STORE_LINKS } from "@extra-domain-filters/shared/config/links";

export interface Store {
    href: string;
    name: string;
}

export interface BrowserInfo {
    id: string;
    /** The install button: "Add to Edge". */
    action: string;
    logo: string;
    name: string;
    /** Where to get it, its own store first. */
    stores: readonly Store[];
}

// The browsers' own logos, from the browser-logos packages (github.com/alrra/browser-logos).
// Safari uses the round compass, which sits with the other round logos.
function logo(src: string): string {
    return `<img src="${src}" alt="" width="48" height="48" decoding="async">`;
}

export const CHROME_WEB_STORE: Store = { href: STORE_LINKS.chrome, name: "Chrome Web Store" };
export const FIREFOX_ADD_ONS: Store = { href: STORE_LINKS.firefox, name: "Firefox Add-ons" };
const EDGE_ADD_ONS: Store = { href: STORE_LINKS.edge, name: "Edge Add-ons" };
const OPERA_ADD_ONS: Store = { href: STORE_LINKS.opera, name: "Opera add-ons" };

/** Every browser it installs in. Edge and Opera also install from the Chrome Web Store. */
export const BROWSERS: readonly BrowserInfo[] = [
    { id: "chrome", action: "Add to Chrome", logo: logo(chromeLogo), name: "Chrome", stores: [CHROME_WEB_STORE] },
    { id: "edge", action: "Add to Edge", logo: logo(edgeLogo), name: "Edge", stores: [EDGE_ADD_ONS, CHROME_WEB_STORE] },
    { id: "firefox", action: "Add to Firefox", logo: logo(firefoxLogo), name: "Firefox", stores: [FIREFOX_ADD_ONS] },
    { id: "opera", action: "Add to Opera", logo: logo(operaLogo), name: "Opera", stores: [OPERA_ADD_ONS, CHROME_WEB_STORE] },
    {
        id: "safari",
        action: "Build for Safari",
        logo: logo(safariLogo),
        name: "Safari on Mac",
        stores: [{ href: STORE_LINKS.safari, name: "Build instructions" }],
    },
    { id: "brave", action: "Add to Brave", logo: logo(braveLogo), name: "Brave", stores: [CHROME_WEB_STORE] },
    { id: "vivaldi", action: "Add to Vivaldi", logo: logo(vivaldiLogo), name: "Vivaldi", stores: [CHROME_WEB_STORE] },
    { id: "opera-gx", action: "Add to Opera GX", logo: logo(operaGxLogo), name: "Opera GX", stores: [OPERA_ADD_ONS, CHROME_WEB_STORE] },
];

/** The main browsers, each with its own store (the footer lists these). */
export const MAIN_BROWSERS = BROWSERS.slice(0, 5);

/** The browser this page is open in, so the install button can name it. Chrome otherwise. */
export function detectBrowser(userAgent = navigator.userAgent): BrowserInfo {
    // Brave and Vivaldi send Chrome's user agent; Brave says so on navigator.
    const id = /Edg\//.test(userAgent) ? "edge"
        : /OPR\/|Opera/.test(userAgent) ? "opera"
        : /Firefox\//.test(userAgent) ? "firefox"
        : /Safari\//.test(userAgent) && !/Chrome|Chromium|CriOS|Android/.test(userAgent) ? "safari"
        : "brave" in navigator ? "brave"
        : "chrome";
    return BROWSERS.find(browser => browser.id === id) ?? BROWSERS[0];
}

const EXTERNAL = externalSvg
    .replace(/<\?xml[^>]*>|<!--[\s\S]*?-->/g, "")
    .replace(/\s(?:width|height)="[^"]*"/g, "")
    .replace("<svg", '<svg class="site-external" aria-hidden="true" focusable="false"')
    .trim();

/** A link to another site: it opens in a new tab, which its icon (and, for screen readers, its text) says. */
export function externalLink(href: string, content: string, className = ""): string {
    return `<a${className ? ` class="${className}"` : ""} href="${href}" target="_blank" rel="noopener noreferrer">${content}${EXTERNAL}<span class="site-visually-hidden"> (opens in a new tab)</span></a>`;
}

/** The install button for a browser: its logo, "Add to <browser>" and, on the large button, the store it opens. */
export function installButton(browser: BrowserInfo, size: "large" | "small" = "large"): string {
    const store = size === "large" ? `<small>${browser.stores[0].name}</small>` : "";
    return externalLink(
        browser.stores[0].href,
        `<span class="site-button-logo">${browser.logo}</span><span class="site-button-text"><strong>${browser.action}</strong>${store}</span>`,
        `site-button site-button-${size}`,
    );
}
