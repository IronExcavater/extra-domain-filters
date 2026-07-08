import { createClaimTracker } from "../core/claim";
import { queueForegroundContrastSync } from "../core/contrast";
import { replaceWithBinIcon } from "../core/icons";
import { PageContext } from "../core/router";
import { getSettings, type Settings } from "../core/settings";
import { getFromStorage, onStorageChange, setInStorage } from "../core/storage";
import { resolveListingSnapshot } from "../listings/cache";
import {
    addBlacklistEntry,
    isBlacklisted,
    matchListing,
    removeBlacklistEntry,
    type ListingSnapshot,
    type BlacklistEntry,
} from "../matching";
import { bindAdRemoval } from "./ads";

const SHORTLIST_BUTTON_SELECTOR = '[data-testid^="listing-card-shortlist"]';
const BLACKLIST_BUTTON_SELECTOR = '[data-testid="listing-card-blacklist"]';
const BUTTON_CONTAINER_CLASS = "edf-listing-card-button-container";
const PROJECT_CARD_SELECTOR = 'li[data-testid^="listing-"]';
const PROJECT_MARKER_SELECTOR = '[data-testid="listing-card-project"]';
const LISTING_CARD_CONTAINER_SELECTOR = '[data-testid="listing-card-container"]';
const SUMMARY_SELECTOR = '[data-testid="listing-card-blacklist-summary"]';
const BLACKLIST_KIND_CLASSES = [
    "edf-blacklist-kind-standard",
    "edf-blacklist-kind-carousel-child",
    "edf-blacklist-kind-project",
    "edf-blacklist-kind-project-child",
];
const CARD_SELECTOR = [
    LISTING_CARD_CONTAINER_SELECTOR,
    '[data-testid="listing-card-child-listing"]',
    'li[data-testid="topspot"]',
    'li[data-testid^="listing-"]',
].join(',');

const claimShortlistButton = createClaimTracker<HTMLButtonElement>();
const claimProjectCard = createClaimTracker<HTMLElement>();
let scanFrame: number | undefined;

type BlacklistCardKind =
    | "standard"
    | "carousel-child"
    | "project"
    | "project-child";

function getCard(button: Element): Element | undefined {
    if ((button as HTMLElement).dataset.blacklistScope === "project") {
        return button.closest(PROJECT_CARD_SELECTOR) ?? undefined;
    }

    return button.closest(CARD_SELECTOR) ?? undefined;
}

function getBlacklistCardKind(card: Element, button?: Element): BlacklistCardKind {
    if ((button as HTMLElement | undefined)?.dataset.blacklistScope === "project") {
        return "project";
    }

    if (card.matches('[data-testid="listing-card-child-listing"]')) {
        const projectCard = card.closest(PROJECT_CARD_SELECTOR);
        return projectCard?.querySelector(PROJECT_MARKER_SELECTOR)
            ? "project-child"
            : "carousel-child";
    }

    return "standard";
}

function getListingUrl(button: Element, card: Element): string | undefined {
    const anchor =
        (button as HTMLElement).dataset.blacklistScope === "project"
            ? card.querySelector<HTMLAnchorElement>('a[href*="/project/"]')
            : button.closest<HTMLAnchorElement>("a[href]") ??
                card.querySelector<HTMLAnchorElement>('a[href*="domain.com.au"]');

    if (!anchor) return undefined;

    return new URL(anchor.href, window.location.origin).href;
}

function getTitle(card: Element): string {
    return (
        card.querySelector('[data-testid="address-wrapper"], [data-testid*="address"], h2, h3')
            ?.textContent?.trim() ??
        card.querySelector<HTMLImageElement>("img")?.alt?.replace(/^Picture of\s+/i, "").trim() ??
        card.querySelector('[data-testid="listing-card-price"]')?.textContent?.trim() ??
        "Domain listing"
    );
}

function getThumbnailUrl(card: Element): string | undefined {
    return card.querySelector<HTMLImageElement>("img")?.src;
}

function getFeature(card: Element, pattern: RegExp): string | undefined {
    for (const feature of card.querySelectorAll('[data-testid="property-features-feature"]')) {
        const text = feature.textContent?.trim().replace(/\s+/g, " ");
        const match = text?.match(pattern);

        if (match) return match[1];
    }

    return undefined;
}

function getListingSnapshot(card: Element, url: string): ListingSnapshot {
    const title = getTitle(card);

    return {
        url,
        title,
        text: card.textContent ?? "",
        displayAddress: title,
        features: {
            bathrooms: getFeature(card, /^(\d+)\s*Bath/i),
            bedrooms: getFeature(card, /^(\d+)\s*Beds?/i),
            parking: getFeature(card, /^(\d+)\s*Parking/i),
        },
        price: card.querySelector('[data-testid="listing-card-price"]')
            ?.textContent?.trim(),
        status: card.querySelector('[data-testid="listing-card-tag"]')
            ?.textContent?.trim(),
        thumbnailUrl: getThumbnailUrl(card),
    };
}

function getPropertyCount(card: Element): number {
    const children = card.querySelectorAll('[data-testid="listing-card-child-listing"]').length;
    return Math.max(children, 1);
}

function getBlacklistSummaryText(card: Element): string {
    const count = getPropertyCount(card);
    const title = getTitle(card);

    if (count > 1) return `${count} properties blacklisted`;

    return `Blacklisted: ${title}`;
}

function getSummary(card: Element): HTMLElement {
    const existing = card.querySelector<HTMLElement>(SUMMARY_SELECTOR);
    if (existing) return existing;

    const summary = document.createElement("div");
    const text = document.createElement("span");
    const button = document.createElement("button");
    const icon = document.createElementNS("http://www.w3.org/2000/svg", "svg");

    summary.className = "edf-blacklist-summary";
    summary.setAttribute("data-testid", "listing-card-blacklist-summary");

    text.className = "edf-blacklist-summary-text";
    text.setAttribute("data-testid", "listing-card-blacklist-summary-text");

    icon.setAttribute("aria-hidden", "true");
    icon.setAttribute("width", "18");
    icon.setAttribute("height", "18");
    replaceWithBinIcon(icon);

    button.type = "button";
    button.className = "edf-blacklist-summary-button";
    button.setAttribute("data-testid", "listing-card-blacklist-restore");
    button.append(icon, "Unblacklist");

    summary.append(text, button);
    card.prepend(summary);

    return summary;
}

function applyBlacklistCardState(
    card: Element,
    button: HTMLButtonElement,
    blacklisted: boolean,
): void {
    const kind = getBlacklistCardKind(card, button);

    card.classList.remove(...BLACKLIST_KIND_CLASSES);
    card.classList.add(`edf-blacklist-kind-${kind}`);
    card.classList.toggle("edf-listing-card-blacklisted", blacklisted);
}

function hasActiveExclusion(settings: Settings, blacklist: BlacklistEntry[]): boolean {
    return (
        blacklist.length > 0 ||
        settings.filters.excludeKeywords.length > 0 ||
        settings.filters.strataMaxDollars < 2000
    );
}

function updateButton(button: HTMLButtonElement, active: boolean, text = "Add to blacklist"): void {
    button.dataset.active = String(active);
    button.ariaLabel = active ? "Remove from blacklist" : text;
    button.title = active ? "Remove from blacklist" : text;
    button.setAttribute("aria-pressed", String(active));
}

function isShortlisted(shortlistButton: HTMLButtonElement): boolean {
    return (
        shortlistButton.dataset.testid?.includes("shortlisted") === true ||
        /^remove\b/i.test(shortlistButton.ariaLabel ?? "")
    );
}

function removeFromShortlist(shortlistButton: HTMLButtonElement): void {
    if (!isShortlisted(shortlistButton)) return;

    requestAnimationFrame(() => shortlistButton.click());
}

function updateExistingCards(settings: Settings, blacklist: BlacklistEntry[]): void {
    document.querySelectorAll<HTMLButtonElement>(BLACKLIST_BUTTON_SELECTOR)
        .forEach(button => {
            const card = getCard(button);
            if (!card) return;

            const url = getListingUrl(button, card);
            if (!url) return;

            const match = matchListing(getListingSnapshot(card, url), settings, blacklist);
            const summary = getSummary(card);
            const summaryText = summary.querySelector('[data-testid="listing-card-blacklist-summary-text"]');

            if (summaryText) summaryText.textContent = getBlacklistSummaryText(card);

            updateButton(button, match.blacklisted);
            applyBlacklistCardState(card, button, match.blacklisted);
            (card as HTMLElement).hidden =
                hasActiveExclusion(settings, blacklist) && match.excluded && !match.blacklisted;
            (card as HTMLElement).style.outline = !match.blacklisted && match.matchedPreferences.length > 0
                ? "3px solid #fc0"
                : "";
        });
}

function cloneBlacklistButton(shortlistButton: HTMLButtonElement): HTMLButtonElement {
    const button = shortlistButton.cloneNode(true) as HTMLButtonElement;
    const icon = button.querySelector("svg");

    button.type = "button";
    button.setAttribute("data-testid", "listing-card-blacklist");

    if (icon) replaceWithBinIcon(icon);

    return button;
}

function insertBlacklistButton(
    shortlistButton: HTMLButtonElement,
    blacklistButton: HTMLButtonElement
): void {
    const parent = shortlistButton.parentElement;
    if (!parent) return;

    parent.classList.add(BUTTON_CONTAINER_CLASS);
    shortlistButton.after(blacklistButton);
}

async function refreshBlacklistSnapshot(
    listing: ListingSnapshot,
    context: PageContext,
): Promise<void> {
    const detailedListing = await resolveListingSnapshot(listing, {
        signal: context.signal,
        includeDetail: true,
    });
    const blacklist = (await getFromStorage<BlacklistEntry[]>("blacklist")) ?? [];

    if (!isBlacklisted(blacklist, listing.url)) return;

    await setInStorage("blacklist", addBlacklistEntry(blacklist, detailedListing));
}

async function toggleBlacklist(
    card: Element,
    url: string,
    context: PageContext,
    shortlistButton?: HTMLButtonElement,
    button?: HTMLButtonElement
): Promise<void> {
    const blacklist = (await getFromStorage<BlacklistEntry[]>("blacklist")) ?? [];
    const active = isBlacklisted(blacklist, url);
    const adding = !active;
    const listing = getListingSnapshot(card, url);
    const next = active
        ? removeBlacklistEntry(blacklist, url)
        : addBlacklistEntry(blacklist, listing);

    await setInStorage("blacklist", next);
    if (adding && shortlistButton) removeFromShortlist(shortlistButton);
    if (button) updateButton(button, !active);

    if (adding) {
        void refreshBlacklistSnapshot(listing, context).catch(error =>
            context.logger.warn("Failed to refresh blacklist listing details", error)
        );
    }
}

function bindBlacklistButton(
    shortlistButton: HTMLButtonElement,
    context: PageContext
): HTMLButtonElement | undefined {
    const card = getCard(shortlistButton);
    if (!card) return undefined;

    const url = getListingUrl(shortlistButton, card);
    if (!url) return undefined;

    const button = cloneBlacklistButton(shortlistButton);
    insertBlacklistButton(shortlistButton, button);

    getSummary(card)
        .querySelector<HTMLButtonElement>('[data-testid="listing-card-blacklist-restore"]')
        ?.addEventListener("click", event => {
            event.preventDefault();
            event.stopPropagation();
            void toggleBlacklist(card, url, context, shortlistButton, button);
        });

    button.addEventListener("click", async event => {
        event.preventDefault();
        event.stopPropagation();
        await toggleBlacklist(card, url, context, shortlistButton, button);
    });

    return button;
}

function bindProjectCard(projectCard: HTMLElement, context: PageContext): void {
    if (!projectCard.querySelector(PROJECT_MARKER_SELECTOR)) return;

    const sourceButton = projectCard.querySelector<HTMLButtonElement>(SHORTLIST_BUTTON_SELECTOR);
    const projectHeader = projectCard.querySelector<HTMLElement>(PROJECT_MARKER_SELECTOR);
    const url = projectCard.querySelector<HTMLAnchorElement>('a[href*="/project/"]')?.href;
    if (!sourceButton || !projectHeader || !url) return;
    if (!claimProjectCard(projectCard)) return;

    const button = cloneBlacklistButton(sourceButton);
    button.dataset.blacklistScope = "project";
    button.classList.add("edf-project-blacklist-button");
    projectHeader.prepend(button);
    queueForegroundContrastSync(button, { scope: projectCard });

    getSummary(projectCard)
        .querySelector<HTMLButtonElement>('[data-testid="listing-card-blacklist-restore"]')
        ?.addEventListener("click", event => {
            event.preventDefault();
            event.stopPropagation();
            void toggleBlacklist(projectCard, url, context, sourceButton, button);
        });

    button.addEventListener("click", async event => {
        event.preventDefault();
        event.stopPropagation();
        await toggleBlacklist(projectCard, url, context, sourceButton, button);
    });
}

export async function injectListingCards(context: PageContext): Promise<void> {
    for (const projectCard of document.querySelectorAll<HTMLElement>(PROJECT_CARD_SELECTOR)) {
        bindProjectCard(projectCard, context);
    }

    for (const shortlistButton of document.querySelectorAll<HTMLButtonElement>(SHORTLIST_BUTTON_SELECTOR)) {
        if (!claimShortlistButton(shortlistButton)) continue;
        bindBlacklistButton(shortlistButton, context);
    }

    const [settings, blacklist = []] = await Promise.all([
        getSettings(),
        getFromStorage<BlacklistEntry[]>("blacklist"),
    ]);

    updateExistingCards(settings, blacklist);
}

export function bindListingCards(context: PageContext): void {
    bindAdRemoval(context.signal);

    const schedule = (): void => {
        if (scanFrame !== undefined) return;

        scanFrame = requestAnimationFrame(() => {
            scanFrame = undefined;
            void injectListingCards(context).catch(error =>
                context.logger.warn("Failed to inject listing cards", error)
            );
        });
    };

    schedule();

    const observer = new MutationObserver(schedule);
    observer.observe(document.body, { childList: true, subtree: true });
    context.signal.addEventListener("abort", () => {
        observer.disconnect();
        if (scanFrame !== undefined) cancelAnimationFrame(scanFrame);
    }, { once: true });

    const refresh = (): void => {
        void injectListingCards(context).catch(error =>
            context.logger.warn("Failed to refresh listing cards", error)
        );
    };
    const unwatchBlacklist = onStorageChange<BlacklistEntry[]>("blacklist", refresh);
    const unwatchSettings = onStorageChange("settings", refresh);

    context.signal.addEventListener("abort", () => {
        unwatchBlacklist();
        unwatchSettings();
    }, { once: true });
}
