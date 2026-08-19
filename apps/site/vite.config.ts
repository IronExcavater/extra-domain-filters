import { resolve } from "node:path";
import { fileURLToPath, URL } from "node:url";
import { defineConfig } from "vite";

const appRoot = fileURLToPath(new URL(".", import.meta.url));
const repositoryRoot = resolve(appRoot, "../..");

export default defineConfig({
    root: appRoot,
    publicDir: resolve(repositoryRoot, "packages/assets"),
    server: {
        host: "127.0.0.1",
        port: 5175,
        strictPort: true,
    },
    build: {
        emptyOutDir: false,
        outDir: resolve(repositoryRoot, "hosting"),
        sourcemap: false,
    },
});
