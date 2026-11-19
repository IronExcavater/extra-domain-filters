import blacklistShot from "../../../docs/store/web/blacklist.webp";
import filtersMoreShot from "../../../docs/store/web/filters-more.webp";
import filtersShot from "../../../docs/store/web/filters.webp";
import savedSearchesShot from "../../../docs/store/web/saved-searches.webp";
import signInShot from "../../../docs/store/web/sign-in.webp";
import syncSvg from "../../../packages/assets/icons/account/sync.svg?raw";
import checkSvg from "../../../packages/assets/icons/actions/check.svg?raw";
import closeSvg from "../../../packages/assets/icons/actions/close.svg?raw";
import starSvg from "../../../packages/assets/icons/actions/star.svg?raw";
import trashSvg from "../../../packages/assets/icons/actions/trash.svg?raw";
import couldHavesSvg from "../../../packages/assets/icons/filters/could-haves.svg?raw";
import strataSvg from "../../../packages/assets/icons/filters/strata.svg?raw";
import chevronSvg from "../../../packages/assets/icons/navigation/chevron.svg?raw";
import bellSvg from "../../../packages/assets/icons/search/bell.svg?raw";
import { detectBrowser, externalLink, installButton, STORES } from "./browsers";
import { features, places, type Feature, type IconName, type Place } from "./content";
import listingPhoto from "./images/listing-photo.webp";

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
        </div>`;
}

function hero(): string {
    const browser = detectBrowser();
    return `
        <section class="site-hero">
            <div class="site-shell site-hero-grid">
                <div class="site-hero-copy">
                    <h1>Domain, with the filters it's&nbsp;missing</h1>
                    <p class="site-hero-lede">Tick the extras you're after, like a pool or solar, set a strata limit, and hide listings you've ruled out for good. It all works inside domain.com.au's own search.</p>
                    <div class="site-hero-actions">
                        ${installButton(browser)}
                        <a class="site-text-link" href="#browsers">Other browsers</a>
                    </div>
                </div>
                ${heroArt()}
            </div>
        </section>`;
}

/** The toolbar popup: pick a feature to read its details and see its page in the popup. */
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
        <section class="site-section site-section-mist" id="toolbar">
            <div class="site-shell">
                <h2 class="site-section-title">All in the toolbar</h2>
                <div class="site-tour">
                    <ul class="site-tour-list">${items}</ul>
                    <figure class="site-tour-shot">${shots}</figure>
                </div>
            </div>
        </section>`;
}

// The extension's could-have tag sparkle (extension: listing-cards/render/preferenceTags.ts).
const SPARKLE = '<svg viewBox="0 0 16 13" aria-hidden="true"><path fill="currentColor" d="M8 1.5l1.4 3.6 3.6 1.4-3.6 1.4L8 11.5 6.6 7.9 3 6.5l3.6-1.4L8 1.5Z"/></svg>';
const CLOSE = icon(closeSvg, "site-icon");

/**
 * Pictures of what the extension puts on each part of Domain, drawn from its own UI and labels
 * (could-have tags on the photo, the hidden-listings summary, the filter cards, the note side of
 * a shortlist card, the alert editor). They're decoration: each place's text says the same.
 */
const PLACE_ART: Record<Place["id"], string> = {
    results: `
        <div class="site-art-listing">
            <div class="site-art-photo">
                <img src="${listingPhoto}" alt="" width="640" height="480" loading="lazy" decoding="async">
                <span class="site-art-photo-actions"><i>${icon(starSvg)}</i><i class="is-extension">${icon(trashSvg)}</i></span>
                <span class="site-art-tags"><b class="is-domain">New</b><b>${SPARKLE}Pool</b><b>${SPARKLE}Solar</b></span>
            </div>
            <div class="site-art-lines"><i></i><i></i></div>
        </div>
        <div class="site-art-summary"><strong>3 listings hidden</strong><span>Show${CHEVRON}</span></div>`,
    "filter-panel": `
        <div class="site-art-card">
            <p class="site-art-card-title">${icon(couldHavesSvg)}Could-haves</p>
            <div class="site-art-chips"><span>Pool${CLOSE}</span><span>Solar${CLOSE}</span><span>Dishwasher${CLOSE}</span></div>
        </div>
        <div class="site-art-card">
            <p class="site-art-card-title">${icon(strataSvg)}Strata fees</p>
            <div class="site-art-slider"><i></i><b></b></div>
            <p class="site-art-card-value">Up to $1,200 a quarter</p>
        </div>`,
    shortlist: `
        <div class="site-art-note">
            <p class="site-art-note-head"><strong>Your note</strong><span>Saved 3:12 pm</span></p>
            <p class="site-art-note-text">Ask about the strata report and the second car space. Inspection Saturday.</p>
            <span class="site-art-button">View details</span>
        </div>`,
    "saved-searches": `
        <div class="site-art-card site-art-alert">
            <p class="site-art-alert-title">${icon(bellSvg)}Edit property alert</p>
            <p class="site-art-alert-text">How often would you like to receive email alerts for this search?</p>
            <div class="site-art-select"><span>Never</span>${CHEVRON}</div>
            <div class="site-art-actions"><span class="site-art-button">Cancel</span><span class="site-art-button is-primary">Update</span></div>
        </div>`,
};

function onDomain(): string {
    const items = places.map(place => `
        <li class="site-place">
            <div class="site-place-art site-place-art-${place.id}" aria-hidden="true">${PLACE_ART[place.id]}</div>
            <h3>${place.title}</h3>
            <p>${place.text}</p>
        </li>`).join("");
    return `
        <section class="site-section site-shell" id="features">
            <h2 class="site-section-title">Right inside Domain</h2>
            <ul class="site-places">${items}</ul>
        </section>`;
}

/**
 * One row per store: its icon, the browsers that install from it (their own first), and one
 * button. The visitor's store is filled in and their browser named in bold.
 */
function browsers(): string {
    const visitor = detectBrowser();
    const rows = STORES.map(store => {
        const isCurrent = store === visitor.store;
        const names = store.browsers.map(item => item.id === visitor.browser.id
            ? `<strong class="site-store-browser">${item.logo}${item.name}<span class="site-visually-hidden"> (your browser)</span></strong>`
            : `<span class="site-store-browser">${item.logo}${item.name}</span>`);
        const list = store.others
            ? `${names.join(", ")} ${store.others}`
            : names.length > 1 ? `${names.slice(0, -1).join(", ")} and ${names.at(-1)}` : names[0];
        const action = store.browsers.some(item => item.id === visitor.browser.id) ? visitor.browser.action : store.browsers[0].action;
        return `
        <li class="site-store"${isCurrent ? " data-current" : ""}>
            <span class="site-store-icon">${store.icon}</span>
            <h3>${store.name}</h3>
            <p class="site-store-browsers">${list}</p>
            ${externalLink(store.href, action, "site-store-button")}
        </li>`;
    }).join("");
    return `
        <section class="site-section site-shell" id="browsers">
            <h2 class="site-section-title">Get it for your browser</h2>
            <ul class="site-stores">${rows}</ul>
        </section>`;
}

export function landing(): string {
    return `
        <main id="site-main">
            ${hero()}
            ${onDomain()}
            ${tour()}
            ${browsers()}
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
