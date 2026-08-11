import { resolve } from "node:path";
import { fileURLToPath, URL } from "node:url";
import { defineConfig } from "vite";

import { getFederatedAuthRuntime } from "./src/config/authRuntime";

const repositoryRoot = fileURLToPath(new URL(".", import.meta.url));

export default defineConfig(({ mode }) => {
    const federatedAuth = getFederatedAuthRuntime(mode);
    return {
        base: "/auth/",
        define: {
            __FEDERATED_AUTH_BRIDGE_URL__: JSON.stringify(federatedAuth.bridgeUrl),
            __FEDERATED_AUTH_MODE__: JSON.stringify(federatedAuth.mode),
        },
        envDir: repositoryRoot,
        root: resolve(repositoryRoot, "src/federated-auth-bridge"),
        server: {
            host: "127.0.0.1",
            port: 5174,
            strictPort: true,
        },
        build: {
            emptyOutDir: true,
            outDir: resolve(repositoryRoot, "hosting/auth"),
            sourcemap: false,
        },
    };
});
