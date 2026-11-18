import { resolve } from "node:path";
import { fileURLToPath, URL } from "node:url";
import { getAuthRuntime } from "@extra-domain-filters/shared/config/auth";
import { defineConfig, type UserManifest } from "wxt";

const DOMAIN_MATCH_PATTERNS = ["*://domain.com.au/*", "*://www.domain.com.au/*"];
const appRoot = fileURLToPath(new URL(".", import.meta.url));
const repositoryRoot = resolve(appRoot, "../..");

const name = "Extra Domain Filters";
const description = "Extra filters, a blacklist and better saved searches for house hunting on domain.com.au.";
const icons = {
    16: "icons/brand/icon-16.png",
    32: "icons/brand/icon-32.png",
    48: "icons/brand/icon-48.png",
    128: "icons/brand/icon-128.png",
};
const permissions = ["storage", "alarms", "unlimitedStorage", "activeTab"];

// Chromium (Chrome, Edge, Opera) signs in to Google, Apple and Facebook through an offscreen
// document that frames the hosted sign-in page.
const chromium: UserManifest = {
    minimum_chrome_version: "116",
    permissions: [...permissions, "offscreen"],
};

// Firefox has no offscreen documents (its users sign in by email) and needs a fixed ID and a
// data-collection declaration: nothing is required; sync, its sign-in and the anonymous
// analytics only run once someone signs in.
const firefox: UserManifest = {
    permissions,
    browser_specific_settings: {
        gecko: {
            id: "extra-domain-filters@extension",
            strict_min_version: "128.0",
            data_collection_permissions: {
                required: ["none"],
                optional: ["authenticationInfo", "personallyIdentifyingInfo", "technicalAndInteraction"],
            },
        },
    },
};

// Safari: as Firefox, without offscreen documents. Package the build with Xcode's
// safari-web-extension-converter.
const safari: UserManifest = { permissions };

const browserManifests: Record<string, UserManifest> = {
    chrome: chromium,
    edge: chromium,
    firefox,
    opera: chromium,
    safari,
};

export default defineConfig({
    srcDir: "src",
    publicDir: resolve(repositoryRoot, "packages/assets"),
    imports: false,
    manifestVersion: 3,
    // A fixed port: when a second dev server picked 3001 the loaded extension kept listening
    // to the first and never reloaded.
    dev: { server: { port: 3000 } },
    zip: { name: "extra-domain-filters" },
    manifest: ({ browser, mode }) => {
        const authRuntime = getAuthRuntime(mode);

        return {
            name,
            description,
            icons,
            action: { default_icon: icons },
            content_security_policy: {
                extension_pages: `script-src 'self'; object-src 'self'; frame-src ${authRuntime.bridgeOrigin}`,
            },
            host_permissions: [
                ...DOMAIN_MATCH_PATTERNS,
                "https://auth.domain.com.au/*",
                "https://firestore.googleapis.com/*",
                "https://identitytoolkit.googleapis.com/*",
                "https://securetoken.googleapis.com/*",
                `${authRuntime.bridgeOrigin}/*`,
            ],
            web_accessible_resources: [{
                resources: ["fonts/F37Bolton-VF.ttf", "offscreen.html"],
                matches: DOMAIN_MATCH_PATTERNS,
            }],
            ...browserManifests[browser] ?? chromium,
        };
    },
    hooks: {
        // The sign-in page's content script (entrypoints/auth-bridge.content.ts) matches the
        // production page; dev builds talk to the local one instead.
        "build:manifestGenerated": (wxt, manifest) => {
            const { bridgeOrigin } = getAuthRuntime(wxt.config.mode);
            for (const script of manifest.content_scripts ?? []) {
                script.matches = script.matches?.map(match =>
                    match.startsWith("https://extra-domain-filters.web.app/auth/") ? `${bridgeOrigin}/auth/*` : match);
            }
        },
    },
    vite: ({ mode }) => {
        const authRuntime = getAuthRuntime(mode);
        return {
            envDir: repositoryRoot,
            define: {
                __AUTH_BRIDGE_URL__: JSON.stringify(authRuntime.bridgeUrl),
                __AUTH_BRIDGE_MODE__: JSON.stringify(authRuntime.mode),
            },
        };
    },
});
