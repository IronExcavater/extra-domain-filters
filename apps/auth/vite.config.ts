import { resolve } from "node:path";
import { fileURLToPath, URL } from "node:url";
import { DEVELOPMENT_BRIDGE_URL, getAuthRuntime } from "@extra-domain-filters/shared/config/auth";
import { defineConfig } from "vite";


const appRoot = fileURLToPath(new URL(".", import.meta.url));
const repositoryRoot = resolve(appRoot, "../..");

export default defineConfig(({ mode }) => {
    const authRuntime = getAuthRuntime(mode);
    return {
        base: "/auth/",
        define: {
            __AUTH_BRIDGE_URL__: JSON.stringify(authRuntime.bridgeUrl),
            __AUTH_BRIDGE_MODE__: JSON.stringify(authRuntime.mode),
        },
        envDir: repositoryRoot,
        root: appRoot,
        server: {
            host: "127.0.0.1",
            port: Number(new URL(DEVELOPMENT_BRIDGE_URL).port),
            strictPort: true,
        },
        build: {
            emptyOutDir: true,
            outDir: resolve(repositoryRoot, "hosting/auth"),
            sourcemap: false,
        },
    };
});
