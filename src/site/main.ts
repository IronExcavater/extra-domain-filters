import "./site.css";

import {
    capabilities,
    CHROME_WEB_STORE_URL,
    EFFECTIVE_DATE,
    GITHUB_URL,
    legalPages,
    SUPPORT_EMAIL,
    type LegalPage,
    type SiteRoute,
} from "./content";

const legalRoutes = new Set<SiteRoute>(["/privacy/", "/terms/", "/data-deletion/"]);

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
                    <a href="/privacy/">Privacy</a>
                    <a href="/terms/">Terms</a>
                    <a href="/data-deletion/">Data deletion</a>
                    <a href="${GITHUB_URL}" target="_blank" rel="noopener noreferrer">GitHub<span aria-hidden="true">↗</span></a>
                    <a href="${mailto()}">Contact</a>
                </nav>
            </div>
        </footer>`;
}

function preview(): string {
    return `
        <div class="site-preview" aria-label="Illustrative Extra Domain Filters extension preview">
            <div class="site-preview-browserbar"><span></span><span></span><span></span><p>domain.com.au/buy</p></div>
            <div class="site-preview-layout">
                <section class="site-preview-rail">
                    <img src="/icons/brand/wordmark.svg" alt="" aria-hidden="true">
                    <p class="site-preview-tab">Filters</p>
                    <p>Saved searches</p>
                    <p>Settings</p>
                    <span class="site-preview-rule"></span>
                    <strong>Property type</strong>
                    <div class="site-preview-options"><span class="is-selected">House</span><span>Unit</span><span>Townhouse</span></div>
                    <strong>Price range</strong>
                    <div class="site-preview-fields"><span>$700k</span><span>$1.5m</span></div>
                    <strong>Preferences</strong>
                    <div class="site-preview-options"><span class="is-selected">3+ beds</span><span>2+ baths</span></div>
                    <div class="site-preview-apply">Apply filters</div>
                </section>
                <section class="site-preview-results">
                    <div class="site-preview-results-head"><p><strong>Buy</strong> · 1,236 results</p><span>Sort: Newest</span></div>
                    <article class="site-preview-listing">
                        <div class="site-preview-image"><span>Saved</span></div>
                        <div class="site-preview-listing-copy"><strong>$1,250,000</strong><p>12 Example Street, Newtown NSW 2042</p><small>House · 3 bed · 2 bath · 2 car</small></div>
                    </article>
                    <div class="site-preview-prompt"><span>⌁</span><p><strong>Make this search yours.</strong><br>Save filters and keep the details that matter.</p></div>
                </section>
            </div>
        </div>`;
}

function landing(): string {
    const capabilityList = capabilities.map(([title, description], index) => `
        <li><span>${String(index + 1).padStart(2, "0")}</span><div><h2>${title}</h2><p>${description}</p></div></li>`).join("");

    return `
        <main id="site-main">
            <section class="site-hero">
                <div class="site-shell site-hero-grid">
                    <div class="site-hero-copy">
                        <h1>A more personal way to search property.</h1>
                        <p>Extra Domain Filters helps you shape Domain.com.au searches around what matters to you.</p>
                        <a class="site-button" href="${CHROME_WEB_STORE_URL}" target="_blank" rel="noopener noreferrer">Get the extension <span aria-hidden="true">↗</span></a>
                    </div>
                    ${preview()}
                </div>
            </section>
            <section class="site-capabilities site-shell" aria-labelledby="capabilities-heading">
                <div class="site-section-heading"><p>Designed for the long search.</p><h2 id="capabilities-heading">Keep the useful details in view.</h2></div>
                <ol>${capabilityList}</ol>
            </section>
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
