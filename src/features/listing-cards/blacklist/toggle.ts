import { addOrReplaceBlacklistEntry, getBlacklist, toggleBlacklistListing } from "../../../domain/blacklist/store";
import { resolveListingSnapshot } from "../../../domain/listings/detail";
import { isBlacklisted, type ListingSnapshot } from "../../../domain/matching";
import { trackTelemetry } from "../../../domain/telemetry/client";
import { removeFromShortlist } from "../../../shared/domain/shortlist";
import { PageContext } from "../../../shared/platform/router";
import { setBlacklistActionState } from "../actions/blacklistAction";
import { getListingSnapshot } from "../dom/card";

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
    void trackTelemetry({ name: "feature_used", feature: "blacklist" });
    if (adding && shortlistButton) removeFromShortlist(shortlistButton);
    if (button) setBlacklistActionState(button, { active: !active });

    if (adding) {
        void refreshBlacklistSnapshot(listing, context).catch(error =>
            context.logger.warn("Failed to refresh blacklist listing details", error)
        );
    }
}
