import { toggleBlacklistListings } from "../../../domain/blacklist/store";
import { isBlacklisted, type BlacklistEntry, type ListingSnapshot } from "../../../domain/matching";
import { isShortlisted, removeFromShortlist } from "../../../shared/domain/shortlist";
import { getCard, getListingUrl, SHORTLIST_BUTTON_SELECTOR } from "../dom/card";

export interface BundleMember {
    url: string;
    snapshot: ListingSnapshot;
}

export async function toggleBundleBlacklist(members: readonly BundleMember[]): Promise<void> {
    const adding = await toggleBlacklistListings(members.map(member => ({
        ...member.snapshot,
        url: member.url,
    })));
    if (!adding) return;

    const urls = new Set(members.map(member => member.url.replace(/\/$/, "")));
    for (const button of document.querySelectorAll<HTMLButtonElement>(SHORTLIST_BUTTON_SELECTOR)) {
        const card = getCard(button);
        const url = card ? getListingUrl(button, card) : undefined;
        if (!url || !urls.has(url.replace(/\/$/, "")) || !isShortlisted(button)) continue;
        removeFromShortlist(button);
    }
}

export function getBlacklistedBundleUrls(
    members: readonly { url: string }[],
    blacklist: readonly BlacklistEntry[],
): string[] {
    return members
        .map(member => member.url)
        .filter(url => isBlacklisted(blacklist, url));
}
