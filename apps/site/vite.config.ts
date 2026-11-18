import { resolve } from "node:path";
import { fileURLToPath, URL } from "node:url";
import { defineConfig, type Plugin } from "vite";

const appRoot = fileURLToPath(new URL(".", import.meta.url));
const repositoryRoot = resolve(appRoot, "../..");
const SITE_URL = "https://extra-domain-filters.web.app";
const PAGES = ["/", "/support/", "/privacy/", "/terms/", "/data-deletion/"];

/** sitemap.xml (linked from the footer) and robots.txt pointing at it, written with the build. */
function sitemap(): Plugin {
    return {
        name: "site-sitemap",
        generateBundle() {
            const urls = PAGES.map(page => `  <url><loc>${SITE_URL}${page}</loc></url>`).join("\n");
            this.emitFile({
                fileName: "sitemap.xml",
                source: `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${urls}\n</urlset>\n`,
                type: "asset",
            });
            this.emitFile({ fileName: "robots.txt", source: `User-agent: *\nAllow: /\nSitemap: ${SITE_URL}/sitemap.xml\n`, type: "asset" });
        },
    };
}

export default defineConfig({
    root: appRoot,
    publicDir: resolve(repositoryRoot, "packages/assets"),
    plugins: [
        sitemap(),
        {
            // Vite rebuilds the entry's script tag without blocking="render"; put it back, so
            // a page is drawn (and cross-faded into) only once its content is in.
            name: "site-render-blocking-entry",
            transformIndexHtml: {
                handler: html => html.replace(/<script type="module"(?![^>]*blocking)/, '<script type="module" blocking="render"'),
                order: "post",
            },
        },
    ],
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
