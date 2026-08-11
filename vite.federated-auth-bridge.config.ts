import { resolve } from "node:path";
import { fileURLToPath, URL } from "node:url";
import { defineConfig } from "vite";

const repositoryRoot = fileURLToPath(new URL(".", import.meta.url));

export default defineConfig({
    base: "/auth/",
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
});
