import { resolve } from "node:path";
import { fileURLToPath, URL } from "node:url";
import { getAuthRuntime } from "@extra-domain-filters/shared/config/auth";
import { defineConfig } from "wxt";

const DOMAIN_MATCH_PATTERNS = ["*://domain.com.au/*", "*://www.domain.com.au/*"];
const appRoot = fileURLToPath(new URL(".", import.meta.url));
const repositoryRoot = resolve(appRoot, "../..");

export default defineConfig({
    srcDir: "src",
    publicDir: resolve(repositoryRoot, "packages/assets"),
    imports: false,
    manifestVersion: 3,
    manifest: ({ mode }) => {
        const authRuntime = getAuthRuntime(mode);

        return {
            name: "Extra Domain Filters",
            description: "Enhance domain.com.au with extra filters to empower your search.",
            minimum_chrome_version: "116",
            icons: {
                16: "icons/brand/icon-16.png",
                32: "icons/brand/icon-32.png",
                48: "icons/brand/icon-48.png",
                128: "icons/brand/icon-128.png",
            },
            action: {
                default_icon: {
                    16: "icons/brand/icon-16.png",
                    32: "icons/brand/icon-32.png",
                    48: "icons/brand/icon-48.png",
                },
            },
            permissions: ["storage", "alarms", "unlimitedStorage", "activeTab", "offscreen"],
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
        };
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
