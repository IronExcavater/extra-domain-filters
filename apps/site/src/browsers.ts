import chromeLogo from "@browser-logos/chrome/chrome.svg?url";
import edgeLogo from "@browser-logos/edge/edge.svg?url";
import firefoxLogo from "@browser-logos/firefox/firefox.svg?url";
import operaLogo from "@browser-logos/opera/opera.svg?url";
import safariLogo from "@browser-logos/safari-ios/safari-ios.svg?url";
import externalSvg from "../../../packages/assets/icons/actions/external.svg?raw";
import { STORE_LINKS, type StoreBrowser } from "@extra-domain-filters/shared/config/links";

export interface BrowserInfo {
    id: StoreBrowser;
    /** The install button: "Add to Edge". */
    action: string;
    /** Other browsers that install it from the same store, where that's true. */
    family?: string;
    href: string;
    logo: string;
    name: string;
    store: string;
}

// The browsers' own logos, from the browser-logos packages (github.com/alrra/browser-logos).
// Safari uses the round compass, which sits with the other round logos.
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
    {
        id: "chrome",
        action: "Add to Chrome",
        family: "Also Brave, Vivaldi, Arc and other Chromium browsers",
        href: STORE_LINKS.chrome,
        logo: logo("chrome"),
        name: "Chrome",
        store: "Chrome Web Store",
    },
    { id: "edge", action: "Add to Edge", family: "Edge can also install it from the Chrome Web Store", href: STORE_LINKS.edge, logo: logo("edge"), name: "Edge", store: "Microsoft Edge Add-ons" },
    {
        id: "firefox",
        action: "Add to Firefox",
        family: "Also Zen, LibreWolf, Waterfox and other Firefox-based browsers",
        href: STORE_LINKS.firefox,
        logo: logo("firefox"),
        name: "Firefox",
        store: "Firefox Add-ons",
    },
    { id: "opera", action: "Add to Opera", family: "Also Opera GX", href: STORE_LINKS.opera, logo: logo("opera"), name: "Opera", store: "Opera add-ons" },
    { id: "safari", action: "Build for Safari", family: "Safari for Mac, built from the source code", href: STORE_LINKS.safari, logo: logo("safari"), name: "Safari", store: "GitHub" },
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

const EXTERNAL = externalSvg
    .replace(/<\?xml[^>]*>|<!--[\s\S]*?-->/g, "")
    .replace(/\s(?:width|height)="[^"]*"/g, "")
    .replace("<svg", '<svg class="site-button-external" aria-hidden="true" focusable="false"')
    .trim();

/**
 * The install button for a browser: its logo, "Add to <browser>" and, on the large button, the
 * store it opens. It opens in a new tab, which the external icon says.
 */
export function installButton(browser: BrowserInfo, size: "large" | "small" = "large"): string {
    const label = size === "large"
        ? `<span class="site-button-text"><strong>${browser.action}</strong><small>${browser.store}</small></span>`
        : `<span class="site-button-text"><strong>${browser.action}</strong></span>`;
    return `<a class="site-button site-button-${size}" href="${browser.href}" target="_blank" rel="noopener noreferrer">
        <span class="site-button-logo">${browser.logo}</span>${label}${EXTERNAL}</a>`;
}
