import { resolveListingSnapshot } from "../domain/listings/cache";
import {
    addBlacklistEntry,
    matchListing,
    removeBlacklistEntry,
    type BlacklistEntry,
} from "../domain/matching";
import { cloneBlacklistButton, isShortlisted, removeFromShortlist, updateButton } from "../features/listing-cards/blacklist/button";
import { PageMount } from "../shared/platform/router";
import { getFromStorage, onStorageChange, setInStorage } from "../shared/platform/storage";
import { getSettings } from "../shared/state/settings";

const CTA_SELECTOR = '[data-testid="listing-details__address-cta-buttons"]';
const SHORTLIST_SELECTOR = '[data-testid="listing-details__address-cta-button-shortlist"]';
const SHARE_SELECTOR = '[data-testid="listing-details__address-cta-button-share"]';

function getAddress(): string {
    return document.querySelector("h1")?.textContent?.trim() || document.title;
}

function getThumbnailUrl(): string | undefined {
    return document.querySelector<HTMLMetaElement>('meta[property="og:image"]')?.content ??
        document.querySelector<HTMLImageElement>("img")?.currentSrc ??
        document.querySelector<HTMLImageElement>("img")?.src;
}

async function isListingBlacklisted(url: string): Promise<boolean> {
    const blacklist = (await getFromStorage<BlacklistEntry[]>("blacklist")) ?? [];
    return matchListing(
        { url, title: "", text: "" },
        await getSettings(),
        blacklist,
    ).exclusionReason === "blacklisted";
}

async function syncButton(button: HTMLButtonElement, url: string): Promise<void> {
    updateButton(button, await isListingBlacklisted(url), "Add to blacklist");
}

function findShortlistButton(): HTMLButtonElement | undefined {
    return document.querySelector<HTMLButtonElement>(SHORTLIST_SELECTOR) ?? undefined;
}

function insertButton(): { button: HTMLButtonElement; shortlistButton?: HTMLButtonElement } {
    const existing = document.querySelector<HTMLButtonElement>('[data-testid="listing-details__blacklist-button"]');
    if (existing) return { button: existing, shortlistButton: findShortlistButton() };

    const cta = document.querySelector<HTMLElement>(CTA_SELECTOR);
    const shortlistButton = findShortlistButton();
    const shareButton = document.querySelector<HTMLButtonElement>(SHARE_SELECTOR);
    const button = shortlistButton
        ? cloneBlacklistButton(shortlistButton)
        : document.createElement("button");

    button.type = "button";
    button.setAttribute("data-testid", "listing-details__blacklist-button");
    button.dataset.blacklistScope = "listing-details";

    if (shortlistButton && isShortlisted(shortlistButton) && shareButton) {
        button.dataset.edfBaseClass = shareButton.className;
        button.className = `${shareButton.className} edf-blacklist-button`;
    } else if (!shortlistButton && shareButton) {
        button.dataset.edfBaseClass = shareButton.className;
        button.className = `${shareButton.className} edf-blacklist-button`;
    }

    if (cta) cta.append(button);
    else document.body.prepend(button);

    return { button, shortlistButton };
}

const mountListingPage: PageMount = async (context) => {
    const url = context.url.href;
    const { button, shortlistButton } = insertButton();

    button.addEventListener("click", async event => {
        event.preventDefault();
        event.stopPropagation();

        const blacklist = (await getFromStorage<BlacklistEntry[]>("blacklist")) ?? [];
        const active = await isListingBlacklisted(url);
        const listing = await resolveListingSnapshot(
            {
                url,
                title: getAddress(),
                text: document.body.textContent ?? "",
                displayAddress: getAddress(),
                thumbnailUrl: getThumbnailUrl(),
            },
            { signal: context.signal, includeDetail: false },
        );
        const next = active
            ? removeBlacklistEntry(blacklist, url)
            : addBlacklistEntry(blacklist, listing);

        await setInStorage("blacklist", next);
        if (!active && shortlistButton) removeFromShortlist(shortlistButton);
        await syncButton(button, url);
    });

    await syncButton(button, url);

    const unwatch = onStorageChange<BlacklistEntry[]>(
        "blacklist",
        () => void syncButton(button, url),
    );
    context.signal.addEventListener("abort", () => {
        unwatch();
        button.remove();
    }, { once: true });
};

export default mountListingPage;
