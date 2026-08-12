import { resolve } from "node:path";
import { fileURLToPath, URL } from "node:url";
import { defineConfig } from "vite";

const repositoryRoot = fileURLToPath(new URL(".", import.meta.url));

export default defineConfig({
    resolve: {
        alias: {
            '@shared': resolve(repositoryRoot, 'src/shared'),
        },
    },
    root: resolve(repositoryRoot, "src/apps/site"),
    publicDir: resolve(repositoryRoot, "public"),
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
