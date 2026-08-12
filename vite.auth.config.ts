import { resolve } from "node:path";
import { fileURLToPath, URL } from "node:url";
import { defineConfig } from "vite";

import { DEVELOPMENT_BRIDGE_URL, getAuthRuntime } from "./src/shared/config/auth";

const repositoryRoot = fileURLToPath(new URL(".", import.meta.url));

export default defineConfig(({ mode }) => {
    const authRuntime = getAuthRuntime(mode);
    return {
        base: "/auth/",
        define: {
            __AUTH_BRIDGE_URL__: JSON.stringify(authRuntime.bridgeUrl),
            __AUTH_BRIDGE_MODE__: JSON.stringify(authRuntime.mode),
        },
        envDir: repositoryRoot,
        resolve: {
            alias: {
                '@shared': resolve(repositoryRoot, 'src/shared'),
            },
        },
        root: resolve(repositoryRoot, "src/apps/auth"),
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
