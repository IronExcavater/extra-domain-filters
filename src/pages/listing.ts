import { getBlacklist, removeBlacklistUrls, toggleBlacklistListing } from "../domain/blacklist/store";
import { resolveListingSnapshot } from "../domain/listings/detail";
import { matchListing, type BlacklistEntry } from "../domain/matching";
import {
    createBlacklistAction,
    setBlacklistActionState,
} from "../features/listing-cards/actions/blacklistAction";
import { enableStickyHeader } from "../features/navigation";
import { isShortlisted, removeFromShortlist } from "../shared/domain/shortlist";
import { PageMount } from "../shared/platform/router";
import { onStorageChange } from "../shared/platform/storage";
import { getSettings } from "../shared/state/settings";

const CTA_SELECTOR = '[data-testid="listing-details__address-cta-buttons"], [data-testid*="cta-buttons"]';
const SHORTLIST_SELECTOR = '[data-testid^="listing-details__address-cta-button-shortlist"], button[aria-label*="shortlist" i]';

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
    setBlacklistActionState(button, {
        active: await isListingBlacklisted(url),
        label: "Blacklist",
    });
}

function findShortlistButton(): HTMLButtonElement | undefined {
    return document.querySelector<HTMLButtonElement>(SHORTLIST_SELECTOR) ?? undefined;
}

const mountListingPage: PageMount = async (context) => {
    enableStickyHeader(context);
    const url = context.url.href;
    const shortlistButton = findShortlistButton();
    document.querySelector('[data-testid="listing-details__blacklist-button"]')?.remove();
    const button = createBlacklistAction({
        active: await isListingBlacklisted(url),
        appearance: "listing-detail",
        label: "Blacklist",
        onToggle: async action => {
            const active = action.getAttribute("aria-pressed") === "true";
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
        },
        signal: context.signal,
    });
    button.dataset.testid = "listing-details__blacklist-button";
    const cta = document.querySelector<HTMLElement>(CTA_SELECTOR);
    if (cta) cta.append(button);
    else shortlistButton?.parentElement?.append(button);
    if (!button.isConnected) return;

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
