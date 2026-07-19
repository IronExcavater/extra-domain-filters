import { addOrReplaceBlacklistEntry, getBlacklist, toggleBlacklistListing } from "../../../domain/blacklist/store";
import { resolveListingSnapshot } from "../../../domain/listings/cache";
import { isBlacklisted, type ListingSnapshot } from "../../../domain/matching";
import { PageContext } from "../../../shared/platform/router";
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
    const blacklist = await getBlacklist();

    if (!isBlacklisted(blacklist, listing.url)) return;

    await addOrReplaceBlacklistEntry(detailedListing);
}

export async function toggleBlacklist(
    card: Element,
    url: string,
    context: PageContext,
    shortlistButton?: HTMLButtonElement,
    button?: HTMLButtonElement
): Promise<void> {
    const blacklist = await getBlacklist();
    const active = isBlacklisted(blacklist, url);
    const adding = !active;
    const listing = getListingSnapshot(card, url);

    await toggleBlacklistListing(listing);
    if (adding && shortlistButton) removeFromShortlist(shortlistButton);
    if (button) updateButton(button, !active);

    if (adding) {
        void refreshBlacklistSnapshot(listing, context).catch(error =>
            context.logger.warn("Failed to refresh blacklist listing details", error)
        );
    }
}
