import {
    addOrReplaceBlacklistEntry,
    getBlacklist,
    removeBlacklistUrls,
} from "../domain/blacklist/store";
import { matchListing, type BlacklistEntry } from "../domain/matching";
import { bindListingCards } from "../features/listing-cards";
import {
    createBlacklistAction,
    setBlacklistActionState,
} from "../features/listing-cards/actions/blacklistAction";
import { enableStickyHeader } from "../features/navigation";
import { onBodyMutations } from "../dom/bodyMutations";
import { PageMount } from "../platform/router";
import { onStorageChange } from "../platform/storage";
import {
    consumeInternalShortlistRemoval,
    isShortlisted,
    removeFromShortlist,
} from "../site-dom/shortlist";
import { getSettings } from "../state/settings";

const SHORTLIST_SELECTOR = [
    '[data-testid^="listing-details__address-cta-button-shortlist"]',
    '[data-testid^="gallery-toolbar-shortlist"]',
    '[data-testid^="vertical-gallery-shortlist"]',
    '[data-testid="listing-details__agency-sticky-header"] button[aria-label*="shortlist" i]',
].join(",");
const DETAIL_BUTTON_SELECTOR = '[data-testid="listing-details__blacklist-button"]';

type ListingActionAppearance = "listing-gallery" | "listing-lightbox" | "listing-sticky";

// Each Domain detail toolbar has a stable Share anchor; the blacklist action joins
// that toolbar as its last item. Unknown layouts get no button rather than a guess.
const NATIVE_TOOLBARS: { anchor: string; appearance: ListingActionAppearance }[] = [
    { anchor: '[data-testid="gallery-toolbar-share-desktop"]', appearance: "listing-gallery" },
    { anchor: '[data-testid="vertical-gallery-share-desktop"]', appearance: "listing-lightbox" },
    {
        anchor: '[data-testid="listing-details__desktop-header"] button[aria-label="Share"]',
        appearance: "listing-sticky",
    },
];

function isLight(color: string): boolean {
    const [r = 0, g = 0, b = 0] = color.match(/[\d.]+/g)?.map(Number) ?? [];
    return (0.2126 * r + 0.7152 * g + 0.0722 * b) / 255 > 0.6;
}

function syncSurface(button: HTMLButtonElement, anchor: HTMLElement): void {
    // Agency-branded sticky headers can be dark. Domain flips its own buttons to a light
    // foreground there, so mirror whatever foreground the sibling Share icon resolved to.
    const foreground = getComputedStyle(anchor.querySelector("svg") ?? anchor).color;
    button.style.setProperty("--edf-listing-fg", foreground);
    button.dataset.edfSurface = isLight(foreground) ? "dark" : "light";
}

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

function findShortlistButtons(): HTMLButtonElement[] {
    return [...document.querySelectorAll<HTMLButtonElement>(SHORTLIST_SELECTOR)];
}

function findDetailActionHosts(): { anchor: HTMLElement; appearance: ListingActionAppearance; host: HTMLElement }[] {
    return NATIVE_TOOLBARS.flatMap(({ anchor: selector, appearance }) =>
        [...document.querySelectorAll<HTMLElement>(selector)].flatMap(anchor =>
            anchor.parentElement ? [{ anchor, appearance, host: anchor.parentElement }] : []));
}

const mountListingPage: PageMount = async (context) => {
    enableStickyHeader(context);
    bindListingCards(context, { showBlacklistedView: false });
    const url = `${context.url.origin}${context.url.pathname}`.replace(/\/+$/, "");
    document.querySelectorAll(DETAIL_BUTTON_SELECTOR).forEach(button => button.remove());
    const buttons = new Map<HTMLElement, HTMLButtonElement>();
    const boundShortlistButtons = new WeakSet<HTMLButtonElement>();

    const createButton = (host: HTMLElement, appearance: ListingActionAppearance): HTMLButtonElement => {
        const button = createBlacklistAction({
            active: false,
            appearance,
            label: "Blacklist",
            onToggle: async (_action, nextActive) => {
                const address = getAddress();
                const listing = {
                    url,
                    title: address,
                    text: address,
                    displayAddress: address,
                    thumbnailUrl: getThumbnailUrl(),
                };

                if (nextActive) {
                    await addOrReplaceBlacklistEntry(listing);
                    findShortlistButtons().forEach(removeFromShortlist);
                } else {
                    await removeBlacklistUrls(listing.url);
                }
            },
            signal: context.signal,
        });
        button.dataset.testid = "listing-details__blacklist-button";
        host.append(button);
        return button;
    };

    const bindShortlistButton = (shortlistButton: HTMLButtonElement): void => {
        if (boundShortlistButtons.has(shortlistButton)) return;
        boundShortlistButtons.add(shortlistButton);
        shortlistButton.addEventListener("click", () => {
            if (consumeInternalShortlistRemoval(shortlistButton)) return;
            requestAnimationFrame(async () => {
                if (!isShortlisted(shortlistButton)) return;
                await removeBlacklistUrls(url);
            });
        }, { signal: context.signal });
    };

    const reconcile = (): void => {
        for (const [host, button] of buttons) {
            if (host.isConnected && button.isConnected) continue;
            button.remove();
            buttons.delete(host);
        }
        findShortlistButtons().forEach(bindShortlistButton);
        for (const { anchor, appearance, host } of findDetailActionHosts()) {
            const existing = buttons.get(host) ?? host.querySelector<HTMLButtonElement>(DETAIL_BUTTON_SELECTOR);
            const button = existing ?? createButton(host, appearance);
            syncSurface(button, anchor);
            if (buttons.has(host)) continue;
            buttons.set(host, button);
            void syncButton(button, url);
        }
    };

    reconcile();
    onBodyMutations(reconcile, context.signal);
    await Promise.all([...buttons.values()].map(button => syncButton(button, url)));

    context.scope.add(onStorageChange<BlacklistEntry[]>(
        "blacklist",
        () => void Promise.all([...buttons.values()].map(button => syncButton(button, url))),
    ));
    context.scope.add(() => buttons.forEach(button => button.remove()));
};

export default mountListingPage;
