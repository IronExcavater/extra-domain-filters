export const CHROME_WEB_STORE_URL = "https://chromewebstore.google.com/detail/extra-domain-filters/opblibcobnkicpdjkinngfcbjjnjldkg";
export const GITHUB_URL = "https://github.com/IronExcavater/extra-domain-filters";
export const SUPPORT_EMAIL = "niclas.rogulski@gmail.com";

export type StoreBrowser = "chrome" | "edge" | "firefox" | "opera" | "safari";

/**
 * Where to get the extension in each browser. Edge, Firefox and Opera point at a store search
 * until their listings are live: swap in the listing URL then. Safari's App Store listing isn't
 * up yet, so it has no link and the site shows it as coming soon.
 */
export const STORE_LINKS: Readonly<Record<StoreBrowser, string | undefined>> = {
    chrome: CHROME_WEB_STORE_URL,
    edge: "https://microsoftedge.microsoft.com/addons/search/extra%20domain%20filters",
    firefox: "https://addons.mozilla.org/en-US/firefox/search/?q=extra%20domain%20filters",
    opera: "https://addons.opera.com/en/search/?query=extra%20domain%20filters",
    safari: undefined,
};
