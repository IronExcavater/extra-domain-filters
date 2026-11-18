import blacklistShot from "../../../docs/store/web/blacklist.webp";
import filtersMoreShot from "../../../docs/store/web/filters-more.webp";
import filtersShot from "../../../docs/store/web/filters.webp";
import savedSearchesShot from "../../../docs/store/web/saved-searches.webp";
import signInShot from "../../../docs/store/web/sign-in.webp";
import settingsSvg from "../../../packages/assets/icons/account/settings.svg?raw";
import syncSvg from "../../../packages/assets/icons/account/sync.svg?raw";
import checkSvg from "../../../packages/assets/icons/actions/check.svg?raw";
import starSvg from "../../../packages/assets/icons/actions/star.svg?raw";
import trashSvg from "../../../packages/assets/icons/actions/trash.svg?raw";
import couldHavesSvg from "../../../packages/assets/icons/filters/could-haves.svg?raw";
import slidersSvg from "../../../packages/assets/icons/filters/sliders.svg?raw";
import chevronSvg from "../../../packages/assets/icons/navigation/chevron.svg?raw";
import bellSvg from "../../../packages/assets/icons/search/bell.svg?raw";
import searchSvg from "../../../packages/assets/icons/search/search.svg?raw";
import { BROWSERS, detectBrowser, installButton } from "./browsers";
import { faqs, features, places, type Feature, type IconName } from "./content";

/** Real popup captures (docs/store/web: WebP copies of the 2x captures the store screenshots use). */
const SHOTS: Record<Feature["shot"], string> = {
    blacklist: blacklistShot,
    filters: filtersShot,
    "filters-more": filtersMoreShot,
    "saved-searches": savedSearchesShot,
    "sign-in": signInShot,
};

/** An icon from the extension's own set (packages/assets/icons), inline so it takes the text colour. */
export function icon(svg: string, className = "site-icon"): string {
    return svg
        .replace(/<\?xml[^>]*>|<!--[\s\S]*?-->/g, "")
        .replace(/\s(?:width|height)="[^"]*"/g, "")
        .replace("<svg", `<svg class="${className}" aria-hidden="true" focusable="false"`)
        .trim();
}

const ICONS: Record<IconName, string> = {
    bell: icon(bellSvg),
    bin: icon(trashSvg),
    "could-haves": icon(couldHavesSvg),
    search: icon(searchSvg),
    settings: icon(settingsSvg),
    sliders: icon(slidersSvg),
    star: icon(starSvg),
    sync: icon(syncSvg),
};
const CHECK = icon(checkSvg, "site-icon site-check");
export const CHEVRON = icon(chevronSvg, "site-icon site-chevron");
const LOCK = `<svg class="site-icon" viewBox="0 0 24 24" aria-hidden="true"><path fill="currentColor" d="M7 10V8a5 5 0 0 1 10 0v2h1a1 1 0 0 1 1 1v9a1 1 0 0 1-1 1H6a1 1 0 0 1-1-1v-9a1 1 0 0 1 1-1h1Zm2 0h6V8a3 3 0 0 0-6 0v2Z"/></svg>`;

function ticks(items: readonly string[]): string {
    return `<ul class="site-ticks">${items.map(item => `<li>${CHECK}<span>${item}</span></li>`).join("")}</ul>`;
}

/**
 * The popup's own tabs, over its captures (all 760x600, the same header): clicking one shows
 * that page, as the real popup would. Positions are fractions of the capture.
 */
const HERO_TABS = [
    { label: "My Searches", left: 50.8, width: 14.4, shot: "saved-searches", alt: "Your saved searches, each with its new listings and email alerts" },
    { label: "Filters", left: 66.4, width: 8.4, shot: "filters", alt: "Filters: could-haves such as a pool, a gym and a dishwasher" },
    { label: "Blacklist", left: 76.2, width: 10, shot: "blacklist", alt: "Your blacklist, with tabs for properties, agencies and agents" },
] as const;

/** The hero's picture: Domain in the address bar, and the popup open under the extension's button. */
function heroArt(): string {
    const shots = HERO_TABS.map(tab => `<img src="${SHOTS[tab.shot]}" alt="${tab.alt}" width="760" height="600" data-hero-shot="${tab.shot}"${tab.shot === "filters" ? ' data-active fetchpriority="high"' : ' loading="lazy"'}>`).join("");
    const tabs = HERO_TABS.map(tab => `<button class="site-hero-tab" type="button" role="tab" aria-selected="${tab.shot === "filters"}" data-hero-tab="${tab.shot}" style="left:${tab.left}%;width:${tab.width}%"><span class="site-visually-hidden">${tab.label}</span></button>`).join("");
    return `
        <div class="site-hero-art">
            <div class="site-toolbar" aria-hidden="true">
                <span class="site-toolbar-dots"><i></i><i></i><i></i></span>
                <p class="site-toolbar-url">${LOCK}<span><strong>domain.com.au</strong>/sale</span></p>
                <span class="site-toolbar-extension"><img src="/icons/brand/icon-48.png" alt="" width="24" height="24"></span>
            </div>
            <figure class="site-hero-popup">
                <div class="site-hero-shots">${shots}</div>
                <div class="site-hero-tabs" role="tablist" aria-label="Popup pages">${tabs}</div>
            </figure>
            <p class="site-hero-hint">${icon(chevronSvg, "site-icon site-hint-arrow")}Try the popup's tabs</p>
        </div>`;
}

function hero(): string {
    const browser = detectBrowser();
    return `
        <section class="site-hero">
            <div class="site-shell site-hero-grid">
                <div class="site-hero-copy">
                    <h1>The filters domain.com.au doesn't&nbsp;have</h1>
                    <p class="site-hero-lede">A browser extension for house hunting on Domain. Filter by the extras you want, hide listings for good, and keep saved searches without the emails.</p>
                    <div class="site-hero-actions">
                        ${installButton(browser)}
                        <a class="site-text-link" href="#browsers">Other browsers</a>
                    </div>
                </div>
                ${heroArt()}
            </div>
        </section>`;
}

/** Features: pick one to read its details and see it in the popup. */
function tour(): string {
    const items = features.map((feature, index) => `
        <li class="site-tour-item"${index === 0 ? " data-active" : ""}>
            <button class="site-tour-button" type="button" aria-expanded="${index === 0}" aria-controls="tour-${feature.id}" data-tour="${feature.id}">
                <span class="site-tour-icon">${ICONS[feature.icon]}</span>
                <span class="site-tour-heading"><strong>${feature.title}</strong><span>${feature.summary}</span></span>
                ${CHEVRON}
            </button>
            <div class="site-tour-detail" id="tour-${feature.id}"><div>${ticks(feature.bullets)}</div></div>
        </li>`).join("");
    const shots = features.map((feature, index) => `
        <img src="${SHOTS[feature.shot]}" alt="${feature.alt}" width="760" height="600" loading="lazy" decoding="async" data-shot="${feature.id}"${index === 0 ? " data-active" : ""}>`).join("");
    return `
        <section class="site-section site-shell" id="features">
            <h2 class="site-section-title">What it adds to Domain</h2>
            <div class="site-tour">
                <ul class="site-tour-list">${items}</ul>
                <figure class="site-tour-shot">${shots}</figure>
            </div>
        </section>`;
}

function onDomain(): string {
    const items = places.map(place => `
        <li>
            <span class="site-place-icon">${place.icon === "extension" ? '<img src="/icons/brand/icon-48.png" alt="" width="22" height="22">' : ICONS[place.icon]}</span>
            <h3>${place.title}</h3>
            <p>${place.text}</p>
        </li>`).join("");
    return `
        <section class="site-section site-section-mist" id="on-domain">
            <div class="site-shell">
                <h2 class="site-section-title">Right inside Domain</h2>
                <ul class="site-places">${items}</ul>
            </div>
        </section>`;
}

/** Every browser, with where to get it; the visitor's own comes first, with the main button. */
function browsers(): string {
    const current = detectBrowser();
    const ordered = [current, ...BROWSERS.filter(browser => browser !== current)];
    const rows = ordered.map(browser => {
        const isCurrent = browser === current;
        return `
        <li class="site-browser"${isCurrent ? " data-current" : ""}>
            ${browser.logo}
            <div class="site-browser-copy">
                <h3>${browser.name}${isCurrent ? '<span class="site-browser-yours">You\'re using it</span>' : ""}</h3>
                ${browser.family ? `<p>${browser.family}</p>` : ""}
            </div>
            <a class="site-browser-link" href="${browser.href}" target="_blank" rel="noopener noreferrer">${browser.store}<span class="site-visually-hidden"> (opens in a new tab)</span></a>
        </li>`;
    }).join("");
    return `
        <section class="site-section site-shell" id="browsers">
            <h2 class="site-section-title">Get it for your browser</h2>
            <ul class="site-browsers">${rows}</ul>
        </section>`;
}

function faq(): string {
    return `
        <section class="site-section site-section-mist" id="faq">
            <div class="site-shell site-faq">
                <h2 class="site-section-title">Questions</h2>
                <div class="site-faq-list">
                    ${faqs.map(item => `<details><summary>${item.question}${CHEVRON}</summary><p>${item.answer}</p></details>`).join("")}
                </div>
            </div>
        </section>`;
}

export function landing(): string {
    return `
        <main id="site-main">
            ${hero()}
            ${tour()}
            ${onDomain()}
            ${browsers()}
            ${faq()}
        </main>`;
}

/** Shows one of a set of stacked captures, fading it in over the last. */
function showShot(shots: readonly HTMLElement[], key: string, attribute: string): void {
    for (const shot of shots) shot.toggleAttribute("data-active", shot.getAttribute(attribute) === key);
}

/** The hero popup's tabs switch its page, as the real popup's do. */
function bindHero(root: HTMLElement): void {
    const tabs = [...root.querySelectorAll<HTMLButtonElement>("[data-hero-tab]")];
    const shots = [...root.querySelectorAll<HTMLImageElement>("[data-hero-shot]")];
    for (const tab of tabs) {
        tab.addEventListener("click", () => {
            for (const other of tabs) other.ariaSelected = String(other === tab);
            showShot(shots, tab.dataset.heroTab ?? "", "data-hero-shot");
            root.querySelector(".site-hero-hint")?.setAttribute("data-used", "");
        });
    }
}

/** One feature open at a time; its capture fades in over the last. */
function bindTour(root: HTMLElement): void {
    const buttons = [...root.querySelectorAll<HTMLButtonElement>("[data-tour]")];
    const shots = [...root.querySelectorAll<HTMLImageElement>("[data-shot]")];
    for (const button of buttons) {
        button.addEventListener("click", () => {
            for (const other of buttons) {
                const active = other === button;
                other.ariaExpanded = String(active);
                other.closest<HTMLElement>(".site-tour-item")?.toggleAttribute("data-active", active);
            }
            showShot(shots, button.dataset.tour ?? "", "data-shot");
        });
    }
}

export function bindLanding(root: HTMLElement): void {
    bindHero(root);
    bindTour(root);
}
