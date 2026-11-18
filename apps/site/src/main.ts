import "./site.css";

import { detectBrowser, externalLink, installButton, STORES } from "./browsers";
import {
    EFFECTIVE_DATE,
    GITHUB_URL,
    legalPages,
    SUPPORT_EMAIL,
    type Faq,
    type LegalPage,
    type SiteRoute,
} from "./content";
import checkSvg from "../../../packages/assets/icons/actions/check.svg?raw";
import copySvg from "../../../packages/assets/icons/actions/copy.svg?raw";
import githubSvg from "../../../packages/assets/icons/support/github.svg?raw";
import mailSvg from "../../../packages/assets/icons/support/mail.svg?raw";
import { bindLanding, CHEVRON, icon, landing } from "./landing";

type PageRoute = Exclude<SiteRoute, "/">;

/** The legal pages, grouped: one "Legal" item in the header, with tabs between them (short
 * names, as they sit under "Legal"); the footer uses the full names. */
const LEGAL_TABS: readonly (readonly [PageRoute, string, string])[] = [
    ["/privacy/", "Privacy", "Privacy policy"],
    ["/terms/", "Terms", "Terms of service"],
    ["/data-deletion/", "Data deletion", "Data deletion"],
];
const LEGAL_ROUTES = new Set<SiteRoute>(LEGAL_TABS.map(([route]) => route));
const PAGE_ROUTES = new Set<SiteRoute>(["/support/", ...LEGAL_ROUTES]);

/** The landing page's sections the header links to; the toolbar popup counts as Features.
 * Questions live on the Support page, with the contact details. */
const SECTIONS = [
    { href: "#features", label: "Features", ids: ["features", "toolbar"] },
    { href: "#browsers", label: "Browsers", ids: ["browsers"] },
] as const;

const ISSUES_URL = `${GITHUB_URL}/issues`;

function pageTitle(route: SiteRoute): string {
    return route === "/" ? "Extra Domain Filters" : `${legalPages[route].title} | Extra Domain Filters`;
}

export function normalizeSiteRoute(pathname: string): SiteRoute {
    const normalized = pathname.endsWith("/") ? pathname : `${pathname}/`;
    return PAGE_ROUTES.has(normalized as SiteRoute) ? normalized as SiteRoute : "/";
}

/**
 * The header, in Domain's style: plain text links, the current one green with a bar along the
 * header's bottom edge, and the install button for the visitor's browser.
 */
function navigation(route: SiteRoute): string {
    const home = route === "/" ? "" : "/";
    const current = (on: boolean) => on ? ' aria-current="page"' : "";
    return `
        <header class="site-header">
            <div class="site-shell site-header-inner">
                <a class="site-brand" href="/" aria-label="Extra Domain Filters home">
                    <img class="site-wordmark" src="/icons/brand/wordmark.svg" alt="Extra Domain Filters" width="230" height="28">
                </a>
                <button class="site-menu-toggle" type="button" aria-controls="site-navigation" aria-expanded="false" aria-label="Menu">
                    <span class="site-menu-toggle-icon" aria-hidden="true"><i></i><i></i><i></i></span>
                </button>
                <nav class="site-navigation" id="site-navigation" aria-label="Primary navigation">
                    <div class="site-nav-links">
                        ${SECTIONS.map(section => `<a class="site-nav-link" href="${home}${section.href}" data-section="${section.ids[0]}">${section.label}</a>`).join("")}
                        <a class="site-nav-link" href="/support/"${current(route === "/support/")}>Support</a>
                        <a class="site-nav-link" href="/privacy/"${current(LEGAL_ROUTES.has(route))}>Legal</a>
                        <span class="site-nav-bar" aria-hidden="true"></span>
                    </div>
                    ${installButton(detectBrowser(), "small")}
                </nav>
            </div>
        </header>`;
}

/** The footer: every page of the site, grouped, then the copyright line. */
function footer(): string {
    const group = (title: string, links: readonly string[]) =>
        `<div class="site-footer-group"><h2>${title}</h2><ul>${links.map(link => `<li>${link}</li>`).join("")}</ul></div>`;
    return `
        <footer class="site-footer">
            <div class="site-shell">
                <div class="site-footer-top">
                    <div class="site-footer-brand">
                        <img src="/icons/brand/wordmark.svg" alt="Extra Domain Filters" width="190" height="23">
                        <p>Extra filters, a blacklist and better saved searches for house hunting on domain.com.au.</p>
                    </div>
                    <nav class="site-footer-nav" aria-label="Site pages">
                        ${group("Extension", ['<a href="/#features">Features</a>', '<a href="/#toolbar">Toolbar popup</a>', '<a href="/#browsers">Browsers</a>'])}
                        ${group("Get it", STORES.map(store => externalLink(store.href, `${store.browsers[0].logo}${store.browsers[0].name}`, "site-footer-browser")))}
                        ${group("Help", ['<a href="/support/">Questions</a>', '<a href="/support/#contact">Contact</a>', externalLink(ISSUES_URL, "Report a problem"), externalLink(GITHUB_URL, "Source code")])}
                        ${group("Legal", LEGAL_TABS.map(([href, , label]) => `<a href="${href}">${label}</a>`))}
                    </nav>
                </div>
                <p class="site-footer-bottom">© ${new Date().getFullYear()} Extra Domain Filters. An independent extension, not affiliated with Domain.</p>
            </div>
        </footer>`;
}

// The asset clips to its own box, which icon() would collapse by dropping sizes: no clip needed.
const GITHUB = icon(githubSvg
    .replace(/<defs>[\s\S]*?<\/defs>/, "")
    .replace(/\sclip-path="[^"]*"/, "")
    .replace('fill="black"', 'fill="currentColor"'));

/**
 * Support's contact details, beside the questions (under the contents list) on wide screens and
 * after them on narrow ones. Every "contact us" on the site links here (/support/#contact).
 */
function contactPanel(): string {
    return `
        <section class="site-contact" id="contact" aria-labelledby="site-contact-title">
            <h2 id="site-contact-title">Contact</h2>
            <p>Questions, problems or ideas? Say which browser you use and what you were doing on Domain.</p>
            <div class="site-contact-email">
                <a href="mailto:${SUPPORT_EMAIL}">${icon(mailSvg)}<span>${SUPPORT_EMAIL}</span></a>
                <button class="site-contact-copy" type="button" data-copy="${SUPPORT_EMAIL}" aria-label="Copy the email address">
                    ${icon(copySvg, "site-icon site-copy-icon")}${icon(checkSvg, "site-icon site-copied-icon")}
                    <span class="site-contact-tip" aria-hidden="true"><span class="is-ready">Copy</span><span class="is-done">Copied</span></span>
                </button>
            </div>
            <p class="site-visually-hidden" aria-live="polite" data-copy-status></p>
            ${externalLink(ISSUES_URL, `${GITHUB}<span>Report a problem on GitHub</span>`, "site-contact-github")}
        </section>`;
}

/** Questions that open to their answers (trusted copy from content.ts, which may hold links). */
function faqList(questions: readonly Faq[]): string {
    return `<div class="site-faq-list">${questions.map(item => `<details><summary>${item.question}${CHEVRON}</summary><p>${item.answer}</p></details>`).join("")}</div>`;
}

/** Tabs between the legal pages; the current one carries the bar that slides between them. */
function legalTabs(route: SiteRoute): string {
    return `
        <nav class="site-legal-tabs" aria-label="Legal">
            <div class="site-shell">
                ${LEGAL_TABS.map(([href, label]) => `<a href="${href}"${href === route ? ' aria-current="page"' : ""}>${label}${href === route ? '<span class="site-legal-tab-bar"></span>' : ""}</a>`).join("")}
            </div>
        </nav>`;
}

/** Support and the legal pages. Their copy is trusted HTML from content.ts, which may hold links. */
function legalPage(route: PageRoute, page: LegalPage): string {
    const toc = page.sections.map(section => `<li><a href="#${section.id}" data-toc="${section.id}">${section.title}</a></li>`).join("");
    const sections = page.sections.map(section => `
        <section id="${section.id}" class="site-legal-section">
            <h2>${section.title}</h2>
            ${section.body.map(paragraph => `<p>${paragraph}</p>`).join("")}
            ${section.questions ? faqList(section.questions) : ""}
        </section>`).join("");
    const isLegal = LEGAL_ROUTES.has(route);

    return `
        <main id="site-main" class="site-legal-main">
            ${isLegal ? legalTabs(route) : ""}
            <div class="site-shell site-legal-layout">
                <aside class="site-legal-toc">
                    <details class="site-toc" open>
                        <summary>On this page${CHEVRON}</summary>
                        <ol>${toc}<li class="site-toc-bar" aria-hidden="true"></li></ol>
                    </details>
                    ${route === "/support/" ? contactPanel() : ""}
                </aside>
                <article class="site-legal-copy">
                    <header class="site-legal-head">
                        <h1>${page.title}</h1>
                        <p class="site-legal-intro">${page.intro}</p>
                        ${isLegal ? `<p class="site-legal-meta">Last updated ${EFFECTIVE_DATE}</p>` : ""}
                    </header>
                    ${sections}
                </article>
            </div>
        </main>`;
}

/** Slides the header's bar under the current link, or hides it when there is none. */
function moveNavBar(root: HTMLElement): void {
    const bar = root.querySelector<HTMLElement>(".site-nav-bar");
    const current = root.querySelector<HTMLElement>(".site-nav-link[aria-current]");
    if (!bar) return;
    bar.style.opacity = current ? "1" : "0";
    if (!current) return;
    bar.style.transform = `translateX(${current.offsetLeft}px)`;
    bar.style.width = `${current.offsetWidth}px`;
}

/** On the landing page, the link for the section in the middle of the screen is current. */
function bindScrollSpy(root: HTMLElement): void {
    const links = [...root.querySelectorAll<HTMLAnchorElement>(".site-nav-link[data-section]")];
    const visible = new Set<string>();
    const observer = new IntersectionObserver(entries => {
        for (const entry of entries) {
            if (entry.isIntersecting) visible.add(entry.target.id);
            else visible.delete(entry.target.id);
        }
        const section = SECTIONS.find(item => item.ids.some(id => visible.has(id)));
        for (const link of links) {
            if (section && link.dataset.section === section.ids[0]) link.setAttribute("aria-current", "location");
            else link.removeAttribute("aria-current");
        }
        moveNavBar(root);
    }, { rootMargin: "-45% 0px -50% 0px" });
    SECTIONS.flatMap(section => section.ids).forEach(id => {
        const element = document.getElementById(id);
        if (element) observer.observe(element);
    });
}

/** The contents list follows the reading position, its bar sliding to the current section. */
function bindToc(root: HTMLElement): void {
    const toc = root.querySelector<HTMLDetailsElement>(".site-toc");
    const bar = root.querySelector<HTMLElement>(".site-toc-bar");
    const links = [...root.querySelectorAll<HTMLAnchorElement>("[data-toc]")];
    if (!toc || !bar || links.length === 0) return;

    // Open beside the page on wide screens; a collapsed list above it on narrow ones.
    const wide = window.matchMedia("(width > 860px)");
    const fit = (): void => { toc.open = wide.matches; };
    wide.addEventListener("change", fit);
    fit();

    const setCurrent = (id: string): void => {
        for (const link of links) {
            if (link.dataset.toc === id) link.setAttribute("aria-current", "location");
            else link.removeAttribute("aria-current");
        }
        const current = links.find(link => link.dataset.toc === id)?.parentElement;
        if (!current) return;
        bar.style.transform = `translateY(${current.offsetTop}px)`;
        bar.style.height = `${current.offsetHeight}px`;
    };
    const sections = links.map(link => document.getElementById(link.dataset.toc ?? "")).filter(section => section !== null);
    const update = (): void => {
        // The last section whose heading has passed the top third of the screen.
        const line = window.innerHeight / 3;
        const atEnd = window.innerHeight + window.scrollY >= document.documentElement.scrollHeight - 4;
        const current = atEnd ? sections.at(-1) : sections.findLast(section => section.getBoundingClientRect().top <= line) ?? sections[0];
        if (current) setCurrent(current.id);
    };
    window.addEventListener("scroll", update, { passive: true });
    window.addEventListener("resize", update);
    update();
    requestAnimationFrame(() => bar.classList.add("is-ready"));
    toc.addEventListener("click", event => {
        if (!wide.matches && event.target instanceof HTMLAnchorElement) toc.open = false;
    });
}

/** The copy button: its icon turns into a tick and its tooltip says "Copied" for a moment. Without
 * clipboard access, the address is selected instead, ready to copy by hand. */
function bindCopy(root: HTMLElement): void {
    const status = root.querySelector<HTMLElement>("[data-copy-status]");
    for (const button of root.querySelectorAll<HTMLButtonElement>("[data-copy]")) {
        let reset: number | undefined;
        button.addEventListener("click", () => {
            navigator.clipboard.writeText(button.dataset.copy ?? "").then(() => {
                button.dataset.copied = "";
                if (status) status.textContent = "Email address copied";
                window.clearTimeout(reset);
                reset = window.setTimeout(() => {
                    delete button.dataset.copied;
                    if (status) status.textContent = "";
                }, 1800);
            }, () => {
                const address = button.parentElement?.querySelector("a span");
                if (address) window.getSelection()?.selectAllChildren(address);
            });
        });
    }
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
        if (event.target instanceof Element && event.target.closest("a")) close();
    });
    window.addEventListener("resize", () => moveNavBar(root));
    // The bar's first position is set without sliding in from the left.
    moveNavBar(root);
    requestAnimationFrame(() => root.querySelector(".site-nav-bar")?.classList.add("is-ready"));
}

export function renderSite(route: SiteRoute, root: HTMLElement): void {
    document.title = pageTitle(route);
    root.innerHTML = `${navigation(route)}${route === "/" ? landing() : legalPage(route, legalPages[route])}${footer()}`;
    document.documentElement.dataset.page = route === "/" ? "home" : "page";
    bindMenu(root);
    if (route === "/") {
        bindLanding(root);
        bindScrollSpy(root);
    } else {
        bindToc(root);
        bindCopy(root);
    }
    // The page is rendered after load, so a #section in the address is scrolled to here.
    if (window.location.hash) document.getElementById(window.location.hash.slice(1))?.scrollIntoView();
}

const root = document.querySelector<HTMLElement>("#app");
if (!root) throw new Error("Public site root is missing.");
renderSite(normalizeSiteRoute(window.location.pathname), root);
