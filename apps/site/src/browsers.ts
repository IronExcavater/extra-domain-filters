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

export interface Browser {
    id: string;
    /** The install button: "Add to Edge". */
    action: string;
    /** The browser's own logo, from the browser-logos packages (github.com/alrra/browser-logos). */
    logo: string;
    name: string;
}

export interface Store {
    id: string;
    /** Browsers that install from this store first. */
    browsers: readonly Browser[];
    /** No link until the listing is live; the store shows as coming soon. */
    href: string | undefined;
    name: string;
    /** Where else it installs from here, in a sentence. */
    note?: string;
}

function browser(id: string, name: string, src: string): Browser {
    return { id, action: `Add to ${name}`, logo: `<img src="${src}" alt="" width="48" height="48" decoding="async">`, name };
}

const CHROME = browser("chrome", "Chrome", chromeLogo);
const BRAVE = browser("brave", "Brave", braveLogo);
const VIVALDI = browser("vivaldi", "Vivaldi", vivaldiLogo);
const FIREFOX = browser("firefox", "Firefox", firefoxLogo);
const EDGE = browser("edge", "Edge", edgeLogo);
const OPERA = browser("opera", "Opera", operaLogo);
const OPERA_GX = browser("opera-gx", "Opera GX", operaGxLogo);
const SAFARI = browser("safari", "Safari on Mac", safariLogo);

/** Every store it's on, each with the browsers that use it first. Edge and Opera have their own
 * stores but can also install from the Chrome Web Store. */
export const STORES: readonly Store[] = [
    {
        id: "chrome-web-store",
        browsers: [CHROME, BRAVE, VIVALDI],
        href: STORE_LINKS.chrome,
        name: "Chrome Web Store",
        note: "Also Arc and any other Chromium browser. Edge and Opera can install from here too.",
    },
    {
        id: "firefox-add-ons",
        browsers: [FIREFOX],
        href: STORE_LINKS.firefox,
        name: "Firefox Add-ons",
        note: "Also Zen, LibreWolf, Waterfox and any other Firefox-based browser.",
    },
    { id: "edge-add-ons", browsers: [EDGE], href: STORE_LINKS.edge, name: "Edge Add-ons" },
    { id: "opera-add-ons", browsers: [OPERA, OPERA_GX], href: STORE_LINKS.opera, name: "Opera add-ons" },
    { id: "app-store", browsers: [SAFARI], href: STORE_LINKS.safari, name: "App Store" },
];

export interface Visitor {
    browser: Browser;
    /** The store this browser installs from first. */
    store: Store;
}

/** The browser this page is open in, and its store, so install buttons can name it. Chrome otherwise. */
export function detectBrowser(userAgent = navigator.userAgent): Visitor {
    // Brave and Vivaldi send Chrome's user agent; Brave says so on navigator.
    const id = /Edg\//.test(userAgent) ? "edge"
        : /OPR\/|Opera/.test(userAgent) ? "opera"
        : /Firefox\//.test(userAgent) ? "firefox"
        : /Safari\//.test(userAgent) && !/Chrome|Chromium|CriOS|Android/.test(userAgent) ? "safari"
        : "brave" in navigator ? "brave"
        : "chrome";
    const store = STORES.find(candidate => candidate.browsers.some(item => item.id === id)) ?? STORES[0];
    return { browser: store.browsers.find(item => item.id === id) ?? store.browsers[0], store };
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

/**
 * The install button for the visitor's browser: its logo, "Add to <browser>" and, on the large
 * button, the store it opens. A store without a listing yet shows as coming soon, not a link.
 */
export function installButton({ browser, store }: Visitor, size: "large" | "small" = "large"): string {
    const logo = `<span class="site-button-logo">${browser.logo}</span>`;
    const detail = size === "large" ? `<small>${store.name}</small>` : "";
    if (!store.href) {
        return `<span class="site-button site-button-${size} site-button-soon">${logo}<span class="site-button-text"><strong>Coming soon to ${browser.name}</strong>${detail}</span></span>`;
    }
    return externalLink(store.href, `${logo}<span class="site-button-text"><strong>${browser.action}</strong>${detail}</span>`, `site-button site-button-${size}`);
}
