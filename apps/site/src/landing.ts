import blacklistShot from "../../../docs/store/web/blacklist.webp";
import filtersShot from "../../../docs/store/web/filters.webp";
import savedSearchesShot from "../../../docs/store/web/saved-searches.webp";
import signInShot from "../../../docs/store/web/sign-in.webp";
import hideSvg from "../../../packages/assets/icons/actions/hide.svg?raw";
import checkSvg from "../../../packages/assets/icons/actions/check.svg?raw";
import trashSvg from "../../../packages/assets/icons/actions/trash.svg?raw";
import syncSvg from "../../../packages/assets/icons/account/sync.svg?raw";
import couldHavesSvg from "../../../packages/assets/icons/filters/could-haves.svg?raw";
import bellSvg from "../../../packages/assets/icons/search/bell.svg?raw";
import { BROWSERS, detectBrowser, installButton } from "./browsers";
import { features, GITHUB_URL, type Feature } from "./content";

/** Real popup captures (docs/store/web: WebP copies of the 2x captures the store screenshots use). */
const SHOTS: Record<Feature["shot"], string> = {
    blacklist: blacklistShot,
    filters: filtersShot,
    "saved-searches": savedSearchesShot,
    "sign-in": signInShot,
};

/** An icon from the extension's own set (packages/assets/icons), inline so it takes the text colour. */
function icon(svg: string, className = "site-icon"): string {
    return svg
        .replace(/<\?xml[^>]*>|<!--[\s\S]*?-->/g, "")
        .replace(/\s(?:width|height)="[^"]*"/g, "")
        .replace("<svg", `<svg class="${className}" aria-hidden="true" focusable="false"`)
        .trim();
}

const ICONS: Record<Feature["icon"], string> = {
    bell: icon(bellSvg),
    bin: icon(trashSvg),
    "could-haves": icon(couldHavesSvg),
    sync: icon(syncSvg),
};
const CHECK = icon(checkSvg, "site-icon site-check");
const LOCK = `<svg viewBox="0 0 24 24" aria-hidden="true"><path fill="currentColor" d="M7 10V8a5 5 0 0 1 10 0v2h1a1 1 0 0 1 1 1v9a1 1 0 0 1-1 1H6a1 1 0 0 1-1-1v-9a1 1 0 0 1 1-1h1Zm2 0h6V8a3 3 0 0 0-6 0v2Z"/></svg>`;

function shot(name: Feature["shot"], alt: string, className = ""): string {
    return `<figure class="site-shot ${className}"><img src="${SHOTS[name]}" alt="${alt}" width="760" height="600" loading="lazy" decoding="async"></figure>`;
}

/**
 * The hero's picture: a browser on a domain.com.au search, with the extension's popup
 * dropping from its toolbar icon over the results.
 */
function heroWindow(): string {
    const card = (tag = "") => `<div class="site-window-card"><span class="site-window-photo"></span><span class="site-window-line"></span><span class="site-window-line short"></span>${tag}</div>`;
    return `
        <div class="site-window" aria-label="The Extra Domain Filters popup open on a domain.com.au search">
            <div class="site-window-bar">
                <span class="site-window-dots" aria-hidden="true"><i></i><i></i><i></i></span>
                <p class="site-window-url">${LOCK}<strong>domain.com.au</strong>/sale/yamba-nsw-2464</p>
                <img class="site-window-extension" src="/icons/brand/icon-48.png" alt="" width="24" height="24">
            </div>
            <div class="site-window-page" aria-hidden="true">
                <div class="site-window-results">
                    ${card(`<span class="site-window-tag">${ICONS["could-haves"]}Pool</span>`)}
                    ${card()}
                    <div class="site-window-hidden">${icon(hideSvg)}3 listings hidden</div>
                    ${card(`<span class="site-window-tag">${ICONS["could-haves"]}Dishwasher</span>`)}
                </div>
                ${shot("filters", "", "site-window-popup")}
            </div>
        </div>`;
}

const DEMO_LISTINGS = [
    { price: "$1,150,000", address: "27 Witonga Drive", meta: "4 bed, 2 bath, 2 car", text: "Family home with solar panels, a pool and a north-facing deck.", hue: 150 },
    { price: "$645,000", address: "12/27 Yamba Road", meta: "1 bed, 1 bath", text: "Studio apartment with ocean views, a short walk to the beach. Strata $950 a quarter.", hue: 200 },
    { price: "$899,000", address: "2/4 Coldstream Street", meta: "3 bed, 2 bath, 1 car", text: "Townhouse with a dishwasher and double glazing. Strata $1,400 a quarter.", hue: 30 },
    { price: "$1,320,000", address: "8 Ocean Street", meta: "3 bed, 2 bath, 2 car", text: "Ocean views from every room, gas cooking, close to cafes.", hue: 260 },
    { price: "$780,000", address: "5/11 Pilot Street", meta: "2 bed, 1 bath, 1 car", text: "Tenanted until June. Dishwasher and balcony. Strata $820 a quarter.", hue: 100 },
];
const DEMO_COULD_HAVES = [["Pool", /\bpool\b/i], ["Solar", /\bsolar\b/i], ["Dishwasher", /dishwasher/i], ["Ocean view", /ocean views?/i]] as const;

/** "Try it": the extension's filters on a small, made-up Yamba search, live. */
function demo(): string {
    const chips = DEMO_COULD_HAVES.map(([label], index) =>
        `<button class="site-chip" type="button" aria-pressed="${index === 0 || index === 3}" data-could-have="${index}">${CHECK}${label}</button>`).join("");
    const listings = DEMO_LISTINGS.map((listing, index) => `
        <li class="site-demo-listing" data-index="${index}">
            <div class="site-demo-listing-inner">
                <span class="site-demo-photo" style="--hue:${listing.hue}"></span>
                <div class="site-demo-copy">
                    <p class="site-demo-price">${listing.price}</p>
                    <p class="site-demo-address">${listing.address}, Yamba</p>
                    <p class="site-demo-meta">${listing.meta}</p>
                    <p class="site-demo-text">${listing.text}</p>
                    <p class="site-demo-tags"></p>
                </div>
            </div>
        </li>`).join("");
    return `
        <section class="site-demo site-shell" id="try" data-reveal>
            <div class="site-heading">
                <h2>Try it on <em>a Yamba search</em></h2>
                <p>Tick, type and slide. The results react just like they do on Domain.</p>
            </div>
            <div class="site-demo-grid">
                <form class="site-demo-controls" aria-label="Demo filters">
                    <fieldset>
                        <legend>Could-haves</legend>
                        <div class="site-chips">${chips}</div>
                    </fieldset>
                    <fieldset>
                        <legend>Exclude keywords</legend>
                        <div class="site-chips" data-keywords></div>
                        <label class="site-demo-input"><span class="site-visually-hidden">Add a keyword</span><input type="text" placeholder="Add a keyword, e.g. tenanted" maxlength="30"></label>
                    </fieldset>
                    <fieldset>
                        <legend>Strata fees</legend>
                        <output class="site-demo-strata-value"></output>
                        <input class="site-range" type="range" min="0" max="2000" step="50" value="1000" aria-label="Maximum quarterly strata">
                    </fieldset>
                </form>
                <div class="site-demo-results">
                    <p class="site-demo-count" aria-live="polite"></p>
                    <ul class="site-demo-list">${listings}</ul>
                    <div class="site-demo-summary" hidden>
                        <p class="site-demo-summary-title"></p>
                        <ul class="site-demo-reasons"></ul>
                    </div>
                </div>
            </div>
        </section>`;
}

function featureSection(feature: Feature, index: number): string {
    const bullets = feature.bullets.map(bullet => `<li>${CHECK}<span>${bullet}</span></li>`).join("");
    return `
        <section class="site-feature${index % 2 ? " site-feature-flip" : ""}" id="${feature.id}" data-reveal>
            <div class="site-feature-copy">
                <span class="site-feature-badge">${ICONS[feature.icon]}</span>
                <h2><em>${feature.accent}</em> ${feature.rest}</h2>
                <ul class="site-ticks">${bullets}</ul>
            </div>
            ${shot(feature.shot, `${feature.accent} ${feature.rest}, in the Extra Domain Filters popup`)}
        </section>`;
}

function getIt(current: string): string {
    const tiles = BROWSERS.map(browser => `
        <li><a class="site-browser${browser.id === current ? " is-current" : ""}" href="${browser.href}" target="_blank" rel="noopener noreferrer">
            <span class="site-browser-logo">${browser.logo}</span>
            <span class="site-browser-name">${browser.name}</span>
            <span class="site-browser-store">${browser.store}</span>
            ${browser.id === current ? '<span class="site-browser-here">You\'re here</span>' : ""}
        </a></li>`).join("");
    return `
        <section class="site-get site-shell" id="browsers" data-reveal>
            <article class="site-price">
                <p class="site-price-tag"><span>$</span>0</p>
                <h2>Free, for good.</h2>
                <ul class="site-ticks">
                    <li>${CHECK}<span>No ads, no upsells</span></li>
                    <li>${CHECK}<span>No account needed</span></li>
                    <li>${CHECK}<span>Open source on <a href="${GITHUB_URL}" target="_blank" rel="noopener noreferrer">GitHub</a></span></li>
                </ul>
            </article>
            <article class="site-browsers">
                <h2>Works where you search</h2>
                <ul class="site-browser-grid">${tiles}</ul>
                <p class="site-browsers-note">Brave, Vivaldi and other Chromium browsers install it from the Chrome Web Store.</p>
            </article>
        </section>`;
}

export function landing(): string {
    const browser = detectBrowser();
    return `
        <main id="site-main">
            <section class="site-hero">
                <div class="site-shell site-hero-grid">
                    <div class="site-hero-copy" data-reveal>
                        <p class="site-for"><span class="site-for-dot"></span>An extension for <strong>domain.com.au</strong></p>
                        <h1>Search Domain <em>your way.</em></h1>
                        <p class="site-hero-lede">The filters, blacklist and saved-search tools Domain doesn't have, right inside its own search.</p>
                        <div class="site-hero-actions">
                            ${installButton(browser)}
                            <a class="site-text-link" href="#try">See it work</a>
                        </div>
                        <ul class="site-hero-browsers" aria-label="Works in">
                            ${BROWSERS.map(item => `<li title="${item.name}">${item.logo}</li>`).join("")}
                        </ul>
                    </div>
                    <div class="site-hero-art" data-reveal>${heroWindow()}</div>
                </div>
            </section>
            ${demo()}
            <div class="site-features site-shell">${features.map(featureSection).join("")}</div>
            ${getIt(browser.id)}
            <section class="site-closing">
                <div class="site-shell site-closing-inner" data-reveal>
                    <div><h2>Make your next search the easy one.</h2><p>Free on Chrome, Edge, Firefox, Opera and Safari.</p></div>
                    ${installButton(browser, "site-button site-button-light")}
                </div>
            </section>
        </main>`;
}

function escapeHtml(value: string): string {
    return value.replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;").replaceAll('"', "&quot;");
}

function formatDollars(value: number): string {
    return value.toLocaleString("en-AU", { currency: "AUD", maximumFractionDigits: 0, style: "currency" });
}

/** The demo's filters, run on its listings as the extension runs them on Domain's. */
function bindDemo(root: HTMLElement): void {
    const section = root.querySelector<HTMLElement>(".site-demo");
    if (!section) return;
    const keywords = new Set(["studio"]);
    const chips = [...section.querySelectorAll<HTMLButtonElement>("[data-could-have]")];
    const keywordHost = section.querySelector<HTMLElement>("[data-keywords]");
    const input = section.querySelector<HTMLInputElement>(".site-demo-input input");
    const range = section.querySelector<HTMLInputElement>(".site-range");
    const strataValue = section.querySelector<HTMLOutputElement>(".site-demo-strata-value");
    const count = section.querySelector<HTMLElement>(".site-demo-count");
    const summary = section.querySelector<HTMLElement>(".site-demo-summary");
    const summaryTitle = section.querySelector<HTMLElement>(".site-demo-summary-title");
    const reasons = section.querySelector<HTMLElement>(".site-demo-reasons");
    const listings = [...section.querySelectorAll<HTMLElement>(".site-demo-listing")];
    if (!keywordHost || !input || !range || !strataValue || !count || !summary || !summaryTitle || !reasons) return;

    const render = (): void => {
        const max = Number(range.value);
        range.style.setProperty("--progress", `${(max / 2000) * 100}%`);
        strataValue.textContent = max >= 2000 ? "No limit" : `Up to ${formatDollars(max)} a quarter`;
        keywordHost.replaceChildren(...[...keywords].map(keyword => {
            const chip = document.createElement("button");
            chip.type = "button";
            chip.className = "site-chip site-chip-remove";
            chip.textContent = keyword;
            chip.ariaLabel = `Stop excluding ${keyword}`;
            chip.addEventListener("click", () => {
                keywords.delete(keyword);
                render();
            });
            return chip;
        }));
        const ticked = DEMO_COULD_HAVES.filter((_, index) => chips[index]?.ariaPressed === "true");
        const hidden: string[] = [];
        let shown = 0;
        DEMO_LISTINGS.forEach((listing, index) => {
            const element = listings[index];
            const keyword = [...keywords].find(word => listing.text.toLowerCase().includes(word.toLowerCase()));
            const strata = Number(listing.text.match(/Strata \$([\d,]+)/)?.[1]?.replaceAll(",", "") ?? 0);
            // The keyword is typed by the visitor, so it is escaped before it goes into HTML.
            const reason = keyword ? `Mentions “${escapeHtml(keyword)}”`
                : max < 2000 && strata > max ? `Strata ${formatDollars(strata)}, over your limit`
                : undefined;
            element.dataset.hidden = String(Boolean(reason));
            if (reason) hidden.push(`<li><strong>${listing.address}</strong><span>${reason}</span></li>`);
            else shown += 1;
            const matched = ticked.filter(([, pattern]) => pattern.test(listing.text));
            const tags = element.querySelector(".site-demo-tags");
            if (tags) tags.innerHTML = matched.map(([label]) => `<span class="site-gold-tag">${label}</span>`).join("");
        });
        count.textContent = `${shown} of ${DEMO_LISTINGS.length} listings shown`;
        summary.hidden = hidden.length === 0;
        summaryTitle.textContent = `${hidden.length} listing${hidden.length === 1 ? "" : "s"} hidden`;
        reasons.innerHTML = hidden.join("");
    };

    for (const chip of chips) {
        chip.addEventListener("click", () => {
            chip.ariaPressed = String(chip.ariaPressed !== "true");
            render();
        });
    }
    input.addEventListener("keydown", event => {
        if (event.key !== "Enter") return;
        event.preventDefault();
        const word = input.value.trim().toLowerCase();
        if (word) keywords.add(word);
        input.value = "";
        render();
    });
    range.addEventListener("input", render);
    render();
}

/** Sections ease in as they scroll into view. */
function bindReveal(root: HTMLElement): void {
    const items = [...root.querySelectorAll<HTMLElement>("[data-reveal]")];
    if (!("IntersectionObserver" in window) || window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    const observer = new IntersectionObserver(entries => {
        for (const entry of entries) {
            if (!entry.isIntersecting) continue;
            (entry.target as HTMLElement).dataset.revealed = "true";
            observer.unobserve(entry.target);
        }
    }, { rootMargin: "0px 0px -10% 0px", threshold: 0.12 });
    for (const item of items) {
        item.dataset.revealed = "false";
        observer.observe(item);
    }
}

export function bindLanding(root: HTMLElement): void {
    bindDemo(root);
    bindReveal(root);
}
