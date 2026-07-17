import { resolveListingSnapshot } from "../../../domain/listings/cache";
import {
    addBlacklistEntry,
    isBlacklisted,
    removeBlacklistEntry,
    type BlacklistEntry,
    type ListingSnapshot,
} from "../../../domain/matching";
import { PageContext } from "../../../shared/platform/router";
import { getFromStorage, setInStorage } from "../../../shared/platform/storage";
import { getListingSnapshot } from "../dom/card";
import { removeFromShortlist, updateButton } from "./button";

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

export async function toggleBlacklist(
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
