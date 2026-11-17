import "./site.css";

import { detectBrowser, installButton } from "./browsers";
import {
    EFFECTIVE_DATE,
    GITHUB_URL,
    legalPages,
    SUPPORT_EMAIL,
    type LegalPage,
    type SiteRoute,
} from "./content";
import { bindLanding, landing } from "./landing";

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

/**
 * The header: the product's sections (on the landing page, or linking back to them), Support,
 * and the install button for the visitor's browser.
 */
function navigation(route: SiteRoute): string {
    const home = route === "/" ? "" : "/";
    const link = (href: string, label: string, current = false) =>
        `<a class="site-nav-link" href="${href}"${current ? ' aria-current="page"' : ""}>${label}</a>`;
    return `
        <header class="site-header">
            <div class="site-shell site-header-inner">
                <a class="site-brand" href="/" aria-label="Extra Domain Filters home">
                    <img class="site-wordmark" src="/icons/brand/wordmark.svg" alt="Extra Domain Filters">
                </a>
                <button class="site-menu-toggle" type="button" aria-controls="site-navigation" aria-expanded="false" aria-label="Menu">
                    <span class="site-menu-toggle-icon" aria-hidden="true"><i></i><i></i><i></i></span>
                </button>
                <nav class="site-navigation" id="site-navigation" aria-label="Primary navigation">
                    ${link(`${home}#filters`, "Features")}
                    ${link(`${home}#try`, "Try it")}
                    ${link(`${home}#browsers`, "Browsers")}
                    ${link("/support/", "Support", route === "/support/")}
                    ${installButton(detectBrowser(), "site-button site-button-small")}
                </nav>
            </div>
        </header>`;
}

function footer(): string {
    return `
        <footer class="site-footer">
            <div class="site-shell site-footer-inner">
                <div class="site-footer-brand">
                    <img src="/icons/brand/wordmark.svg" alt="Extra Domain Filters" width="190" height="23">
                    <p>Made in Australia for people searching on domain.com.au. Not affiliated with Domain.</p>
                </div>
                <nav aria-label="Footer navigation">
                    <a href="/support/">Support</a>
                    <a href="/privacy/">Privacy</a>
                    <a href="/terms/">Terms</a>
                    <a href="/data-deletion/">Data deletion</a>
                    <a href="${GITHUB_URL}" target="_blank" rel="noopener noreferrer">GitHub</a>
                    <a href="${mailto()}">Contact</a>
                </nav>
            </div>
        </footer>`;
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
    // The header gains a shadow once the page scrolls under it.
    const header = root.querySelector<HTMLElement>(".site-header");
    const onScroll = (): void => {
        if (header) header.dataset.scrolled = String(window.scrollY > 8);
    };
    window.addEventListener("scroll", onScroll, { passive: true });
    onScroll();
    navigationElement.addEventListener("click", event => {
        if (event.target instanceof HTMLAnchorElement) close();
    });
}

export function renderSite(route: SiteRoute, root: HTMLElement): void {
    document.title = pageTitle(route);
    root.innerHTML = `${navigation(route)}${route === "/" ? landing() : legalPage(route, legalPages[route])}${footer()}`;
    bindMenu(root);
    if (route === "/") bindLanding(root);
}

const root = document.querySelector<HTMLElement>("#app");
if (!root) throw new Error("Public site root is missing.");
renderSite(normalizeSiteRoute(window.location.pathname), root);
