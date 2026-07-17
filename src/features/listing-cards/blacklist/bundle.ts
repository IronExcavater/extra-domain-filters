import { getFromStorage, setInStorage } from "../../../core/storage";
import {
    addBlacklistEntry,
    isBlacklisted,
    removeBlacklistEntry,
    type BlacklistEntry,
    type ListingSnapshot,
} from "../../../matching";

export interface BundleMember {
    url: string;
    snapshot: ListingSnapshot;
}

export async function toggleBundleBlacklist(members: readonly BundleMember[]): Promise<void> {
    const current = (await getFromStorage<BlacklistEntry[]>("blacklist")) ?? [];
    const allActive = members.length > 0 && members.every(member => isBlacklisted(current, member.url));

    const next = allActive
        ? members.reduce((entries, member) => removeBlacklistEntry(entries, member.url), current)
        : members.reduce((entries, member) => addBlacklistEntry(entries, member.snapshot), current);

    await setInStorage("blacklist", next);
}

export function isBundleActive(
    members: readonly { url: string }[],
    blacklist: readonly BlacklistEntry[],
): boolean {
    return members.length > 0 && members.every(member => isBlacklisted(blacklist, member.url));
}
