import "./site.css";

import blacklistShot from "../../../docs/store/web/blacklist.webp";
import filtersShot from "../../../docs/store/web/filters.webp";
import savedSearchesShot from "../../../docs/store/web/saved-searches.webp";
import signInShot from "../../../docs/store/web/sign-in.webp";
import {
    CHROME_WEB_STORE_URL,
    EFFECTIVE_DATE,
    features,
    GITHUB_URL,
    legalPages,
    SUPPORT_EMAIL,
    type LegalPage,
    type SiteRoute,
} from "./content";

const legalRoutes = new Set<SiteRoute>(["/support/", "/privacy/", "/terms/", "/data-deletion/"]);

function escapeHtml(value: string): string {
    return value.replaceAll("&", "&amp;")
        .replaceAll("<", "&lt;")
        .replaceAll(">", "&gt;")
        .replaceAll('"', "&quot;")
        .replaceAll("'", "&#039;");
}

function mailto(): string {
    return `mailto:${SUPPORT_EMAIL}`;
}

function pageTitle(route: SiteRoute): string {
    return route === "/" ? "Extra Domain Filters" : `${legalPages[route].title} | Extra Domain Filters`;
}

export function normalizeSiteRoute(pathname: string): SiteRoute {
    const normalized = pathname.endsWith("/") ? pathname : `${pathname}/`;
    return legalRoutes.has(normalized as SiteRoute) ? normalized as SiteRoute : "/";
}

function navigation(): string {
    return `
        <header class="site-header">
            <div class="site-shell site-header-inner">
                <a class="site-brand" href="/" aria-label="Extra Domain Filters home">
                    <img class="site-wordmark" src="/icons/brand/wordmark.svg" alt="Extra Domain Filters">
                </a>
                <button class="site-menu-toggle" type="button" aria-controls="site-navigation" aria-expanded="false">
                    <span class="site-menu-toggle-label">Menu</span>
                    <span class="site-menu-toggle-icon" aria-hidden="true"></span>
                </button>
                <nav class="site-navigation" id="site-navigation" aria-label="Primary navigation">
                    <a href="/">Product</a>
                    <a href="/support/">Support</a>
                    <a href="/privacy/">Privacy</a>
                    <a href="/terms/">Terms</a>
                    <a class="site-install-link" href="${CHROME_WEB_STORE_URL}" target="_blank" rel="noopener noreferrer">Get the extension<span aria-hidden="true">↗</span></a>
                </nav>
            </div>
        </header>`;
}

function footer(): string {
    return `
        <footer class="site-footer">
            <div class="site-shell site-footer-inner">
                <p>Extra Domain Filters</p>
                <nav aria-label="Footer navigation">
                    <a href="/support/">Support</a>
                    <a href="/privacy/">Privacy</a>
                    <a href="/terms/">Terms</a>
                    <a href="/data-deletion/">Data deletion</a>
                    <a href="${GITHUB_URL}" target="_blank" rel="noopener noreferrer">GitHub<span aria-hidden="true">↗</span></a>
                    <a href="${mailto()}">Contact</a>
                </nav>
            </div>
        </footer>`;
}

/** Real popup captures (docs/store/web: WebP copies of the 2x captures the store screenshots use). */
const SHOTS: Record<(typeof features)[number][0], string> = {
    blacklist: blacklistShot,
    filters: filtersShot,
    "saved-searches": savedSearchesShot,
    "sign-in": signInShot,
};

function shot(name: keyof typeof SHOTS, alt: string, className = ""): string {
    return `<figure class="site-shot ${className}"><img src="${SHOTS[name]}" alt="${escapeHtml(alt)}" width="760" height="600" loading="lazy"></figure>`;
}

function hero(): string {
    return `
        <div class="site-hero-shots" aria-hidden="true">
            ${shot("saved-searches", "", "site-shot-back")}
            ${shot("filters", "", "site-shot-front")}
            <p class="site-callout"><span>🏊</span>Pool matched</p>
            <p class="site-callout site-callout-low"><span>🚫</span>12 listings hidden</p>
        </div>`;
}

function landing(): string {
    const rows = features.map(([name, accent, rest, text], index) => `
        <section class="site-feature${index % 2 ? " site-feature-flip" : ""}">
            <div class="site-feature-copy">
                <p class="site-feature-number">${String(index + 1).padStart(2, "0")}</p>
                <h2><em>${accent}</em> ${rest}</h2>
                <p>${text}</p>
            </div>
            ${shot(name, `${accent} ${rest}: the Extra Domain Filters popup`)}
        </section>`).join("");

    return `
        <main id="site-main">
            <section class="site-hero">
                <div class="site-shell site-hero-grid">
                    <div class="site-hero-copy">
                        <p class="site-eyebrow">For domain.com.au</p>
                        <h1>The filters <em>Domain doesn't have</em>.</h1>
                        <p>Could-haves, keyword and strata filters, and a blacklist for listings, agencies and agents, right inside Domain's own search.</p>
                        <a class="site-button" href="${CHROME_WEB_STORE_URL}" target="_blank" rel="noopener noreferrer">Add to Chrome <span aria-hidden="true">↗</span></a>
                        <p class="site-hero-note">Free. Works on Chrome, Edge, Firefox, Opera and Safari.</p>
                    </div>
                    ${hero()}
                </div>
            </section>
            <div class="site-features site-shell">${rows}</div>
            <section class="site-closing">
                <div class="site-shell site-closing-inner">
                    <div><p>Find a better starting point.</p><h2>Add the extension when you are ready.</h2></div>
                    <a class="site-button" href="${CHROME_WEB_STORE_URL}" target="_blank" rel="noopener noreferrer">Get the extension <span aria-hidden="true">↗</span></a>
                </div>
            </section>
        </main>`;
}

function legalPage(route: Exclude<SiteRoute, "/">, page: LegalPage): string {
    const toc = page.sections.map(section => `<li><a href="#${section.id}">${section.title}</a></li>`).join("");
    const sections = page.sections.map(section => `
        <section id="${section.id}" class="site-legal-section">
            <h2>${section.title}</h2>
            ${section.body.map(paragraph => `<p>${escapeHtml(paragraph)}</p>`).join("")}
        </section>`).join("");

    return `
        <main id="site-main" class="site-legal-main">
            <div class="site-shell site-legal-layout">
                <aside class="site-legal-toc" aria-label="On this page"><p>On this page</p><ol>${toc}</ol></aside>
                <article class="site-legal-copy">
                    <header><p>Last updated: ${EFFECTIVE_DATE}</p><h1>${page.title}</h1><p class="site-legal-intro">${page.intro}</p></header>
                    ${sections}
                </article>
            </div>
        </main>`;
}

function bindMenu(root: HTMLElement): void {
    const button = root.querySelector<HTMLButtonElement>(".site-menu-toggle");
    const navigationElement = root.querySelector<HTMLElement>(".site-navigation");
    if (!button || !navigationElement) return;

    const close = (): void => {
        button.setAttribute("aria-expanded", "false");
        navigationElement.dataset.open = "false";
    };

    button.addEventListener("click", () => {
        const open = button.getAttribute("aria-expanded") !== "true";
        button.setAttribute("aria-expanded", String(open));
        navigationElement.dataset.open = String(open);
    });
    navigationElement.addEventListener("click", event => {
        if (event.target instanceof HTMLAnchorElement) close();
    });
}

export function renderSite(route: SiteRoute, root: HTMLElement): void {
    document.title = pageTitle(route);
    root.innerHTML = `${navigation()}${route === "/" ? landing() : legalPage(route, legalPages[route])}${footer()}`;
    bindMenu(root);
}

const root = document.querySelector<HTMLElement>("#app");
if (!root) throw new Error("Public site root is missing.");
renderSite(normalizeSiteRoute(window.location.pathname), root);
