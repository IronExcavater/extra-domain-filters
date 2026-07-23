import { getBlacklist, removeBlacklistUrls, toggleBlacklistListing } from "../domain/blacklist/store";
import { resolveListingSnapshot } from "../domain/listings/cache";
import { matchListing, type BlacklistEntry } from "../domain/matching";
import {
    cloneBlacklistButton,
    isShortlisted,
    removeFromShortlist,
    setBlacklistButtonState,
} from "../features/listing-cards/clone/blacklistButton";
import { enableStickyHeader } from "../features/navigation";
import { PageMount } from "../shared/platform/router";
import { onStorageChange } from "../shared/platform/storage";
import { getSettings } from "../shared/state/settings";

const CTA_SELECTOR = '[data-testid="listing-details__address-cta-buttons"], [data-testid*="cta-buttons"]';
const SHORTLIST_SELECTOR = '[data-testid^="listing-details__address-cta-button-shortlist"], button[aria-label*="shortlist" i]';
const SHARE_SELECTOR = '[data-testid="listing-details__address-cta-button-share"]';
const ACTIVE_SHORTLIST_CLASS = "css-11t19a7";

function getAddress(): string {
    return document.querySelector("h1, [data-testid*='title-name']")?.textContent?.trim() || document.title;
}

function getThumbnailUrl(): string | undefined {
    return document.querySelector<HTMLMetaElement>('meta[property="og:image"]')?.content ??
        document.querySelector<HTMLImageElement>("img")?.currentSrc ??
        document.querySelector<HTMLImageElement>("img")?.src;
}

async function isListingBlacklisted(url: string): Promise<boolean> {
    return matchListing(
        { url, title: "", text: "" },
        await getSettings(),
        await getBlacklist(),
    ).exclusionReason === "blacklisted";
}

async function syncButton(button: HTMLButtonElement, url: string): Promise<void> {
    setBlacklistButtonState(button, await isListingBlacklisted(url), "Add to blacklist");
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
        ? cloneBlacklistButton(shortlistButton, {
            skin: {
                active: ACTIVE_SHORTLIST_CLASS,
                inactive: shareButton?.className ?? shortlistButton.className,
            },
        })
        : document.createElement("button");

    button.type = "button";
    button.setAttribute("data-testid", "listing-details__blacklist-button");
    button.dataset.blacklistScope = "listing-details";

    if (!shortlistButton && shareButton) {
        button.dataset.edfInactiveClass = shareButton.className;
        button.dataset.edfActiveClass = ACTIVE_SHORTLIST_CLASS;
        button.className = `${shareButton.className} edf-blacklist-button`;
    }

    if (cta) cta.append(button);
    else shortlistButton?.parentElement?.append(button);

    return { button, shortlistButton };
}

const mountListingPage: PageMount = async (context) => {
    enableStickyHeader(context);
    const url = context.url.href;
    const { button, shortlistButton } = insertButton();
    if (!button.isConnected) return;

    button.addEventListener("click", async event => {
        event.preventDefault();
        event.stopPropagation();

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

        await toggleBlacklistListing(listing);
        if (!active && shortlistButton) removeFromShortlist(shortlistButton);
        await syncButton(button, url);
    }, { signal: context.signal });

    shortlistButton?.addEventListener("click", () => {
        requestAnimationFrame(async () => {
            if (!isShortlisted(shortlistButton)) return;
            await removeBlacklistUrls(url);
        });
    }, { signal: context.signal });

    await syncButton(button, url);

    context.scope.add(onStorageChange<BlacklistEntry[]>(
        "blacklist",
        () => void syncButton(button, url),
    ));
    context.scope.add(() => button.remove());
};

export default mountListingPage;
