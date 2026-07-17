import {
    addBlacklistEntry,
    isBlacklisted,
    removeBlacklistEntry,
    type BlacklistEntry,
    type ListingSnapshot,
} from "../../../domain/matching";
import { getFromStorage, setInStorage } from "../../../shared/platform/storage";

export interface BundleMember {
    url: string;
    snapshot: ListingSnapshot;
}

export async function toggleBundleBlacklist(members: readonly BundleMember[]): Promise<void> {
    const current = (await getFromStorage<BlacklistEntry[]>("blacklist")) ?? [];
    const anyActive = members.some(member => isBlacklisted(current, member.url));

    const next = anyActive
        ? members.reduce((entries, member) => removeBlacklistEntry(entries, member.url), current)
        : members.reduce((entries, member) => addBlacklistEntry(entries, member.snapshot), current);

    await setInStorage("blacklist", next);
}

export function isBundleSelected(
    members: readonly { url: string }[],
    blacklist: readonly BlacklistEntry[],
): boolean {
    return members.some(member => isBlacklisted(blacklist, member.url));
}
