import { toggleBlacklistListings } from "../../../domain/blacklist/store";
import { isBlacklisted, type BlacklistEntry, type ListingSnapshot } from "../../../domain/matching";

export interface BundleMember {
    url: string;
    snapshot: ListingSnapshot;
}

export async function toggleBundleBlacklist(members: readonly BundleMember[]): Promise<void> {
    await toggleBlacklistListings(members.map(member => ({
        ...member.snapshot,
        url: member.url,
    })));
}

export function isBundleSelected(
    members: readonly { url: string }[],
    blacklist: readonly BlacklistEntry[],
): boolean {
    return members.some(member => isBlacklisted(blacklist, member.url));
}

export function getBlacklistedBundleUrls(
    members: readonly { url: string }[],
    blacklist: readonly BlacklistEntry[],
): string[] {
    return members
        .map(member => member.url)
        .filter(url => isBlacklisted(blacklist, url));
}
