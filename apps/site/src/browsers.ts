import braveLogo from "@browser-logos/brave/brave.svg?url";
import chromeLogo from "@browser-logos/chrome/chrome.svg?url";
import edgeLogo from "@browser-logos/edge/edge.svg?url";
import firefoxLogo from "@browser-logos/firefox/firefox.svg?url";
import operaGxLogo from "@browser-logos/opera-gx/opera-gx.svg?url";
import operaLogo from "@browser-logos/opera/opera.svg?url";
import safariLogo from "@browser-logos/safari-ios/safari-ios.svg?url";
import vivaldiLogo from "@browser-logos/vivaldi/vivaldi.svg?url";
import appStoreGlyph from "simple-icons/icons/appstore.svg?raw";
import externalSvg from "../../../packages/assets/icons/actions/external.svg?raw";
import chromeWebStoreIcon from "../../../packages/assets/icons/support/chrome-web-store.svg?url";
import { STORE_LINKS } from "@extra-domain-filters/shared/config/links";

export interface Browser {
    id: string;
    /** The install button: "Add to Edge". */
    action: string;
    /** Its own logo (browser-logos packages, github.com/alrra/browser-logos); none for a few
     * smaller browsers, which are named without one. */
    logo: string;
    name: string;
}

export interface Store {
    id: string;
    /** Every browser that installs from it, its own first. */
    browsers: readonly Browser[];
    href: string;
    /** The store's own icon. Firefox, Edge and Opera's stores use their browser's logo. */
    icon: string;
    name: string;
    /** Named after the browsers: "and other Chromium browsers". */
    others?: string;
}

// The App Store's icon: its glyph (simple-icons) on the store's blue tile.
const APP_STORE_ICON = `data:image/svg+xml,${encodeURIComponent(`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 48 48"><defs><linearGradient id="g" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#1ac0fb"/><stop offset="1" stop-color="#1d6ff2"/></linearGradient></defs><rect width="48" height="48" rx="11" fill="url(#g)"/><path transform="translate(11 11) scale(1.08)" fill="#fff" d="${appStoreGlyph.match(/ d="([^"]+)"/)?.[1] ?? ""}"/></svg>`)}`;

function image(src: string): string {
    return `<img src="${src}" alt="" width="48" height="48" decoding="async">`;
}

function browser(id: string, name: string, src?: string): Browser {
    return { id, action: `Add to ${name}`, logo: src ? image(src) : "", name };
}

const CHROME = browser("chrome", "Chrome", chromeLogo);
const BRAVE = browser("brave", "Brave", braveLogo);
const VIVALDI = browser("vivaldi", "Vivaldi", vivaldiLogo);
const ARC = browser("arc", "Arc");
const EDGE = browser("edge", "Edge", edgeLogo);
const OPERA = browser("opera", "Opera", operaLogo);
const OPERA_GX = browser("opera-gx", "Opera GX", operaGxLogo);
const FIREFOX = browser("firefox", "Firefox", firefoxLogo);
const ZEN = browser("zen", "Zen");
const LIBREWOLF = browser("librewolf", "LibreWolf");
const WATERFOX = browser("waterfox", "Waterfox");
const SAFARI = browser("safari", "Safari", safariLogo);

/**
 * Every store, with every browser that installs from it. Edge and Opera are Chromium browsers
 * with their own stores, so they're under both.
 */
export const STORES: readonly Store[] = [
    {
        id: "chrome-web-store",
        browsers: [CHROME, EDGE, OPERA, BRAVE, VIVALDI, ARC],
        href: STORE_LINKS.chrome,
        icon: image(chromeWebStoreIcon),
        name: "Chrome Web Store",
        others: "and other Chromium browsers",
    },
    {
        id: "firefox-add-ons",
        browsers: [FIREFOX, ZEN, LIBREWOLF, WATERFOX],
        href: STORE_LINKS.firefox,
        icon: FIREFOX.logo,
        name: "Firefox Add-ons",
        others: "and other Firefox-based browsers",
    },
    { id: "edge-add-ons", browsers: [EDGE], href: STORE_LINKS.edge, icon: EDGE.logo, name: "Edge Add-ons" },
    { id: "opera-add-ons", browsers: [OPERA, OPERA_GX], href: STORE_LINKS.opera, icon: OPERA.logo, name: "Opera add-ons" },
    { id: "app-store", browsers: [SAFARI], href: STORE_LINKS.safari, icon: image(APP_STORE_ICON), name: "App Store" },
];

/** Where each browser installs from first: its own store. */
const HOME_STORE: Readonly<Record<string, string>> = { edge: "edge-add-ons", firefox: "firefox-add-ons", opera: "opera-add-ons", safari: "app-store" };

export interface Visitor {
    browser: Browser;
    store: Store;
}

/** The browser this page is open in and the store it installs from, so install buttons can name it. Chrome otherwise. */
export function detectBrowser(userAgent = navigator.userAgent): Visitor {
    // Brave and Vivaldi send Chrome's user agent; Brave says so on navigator.
    const id = /Edg\//.test(userAgent) ? "edge"
        : /OPR\/|Opera/.test(userAgent) ? "opera"
        : /Firefox\//.test(userAgent) ? "firefox"
        : /Safari\//.test(userAgent) && !/Chrome|Chromium|CriOS|Android/.test(userAgent) ? "safari"
        : "brave" in navigator ? "brave"
        : "chrome";
    const store = STORES.find(candidate => candidate.id === HOME_STORE[id])
        ?? STORES.find(candidate => candidate.browsers.some(item => item.id === id))
        ?? STORES[0];
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

/** The install button for the visitor's browser: its logo, "Add to <browser>" and, on the large button, the store it opens. */
export function installButton({ browser, store }: Visitor, size: "large" | "small" = "large"): string {
    const detail = size === "large" ? `<small>${store.name}</small>` : "";
    return externalLink(
        store.href,
        `<span class="site-button-logo">${browser.logo}</span><span class="site-button-text"><strong>${browser.action}</strong>${detail}</span>`,
        `site-button site-button-${size}`,
    );
}
