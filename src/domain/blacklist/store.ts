import { getFromStorage, setInStorage } from "../../shared/platform/storage";
import {
    addBlacklistEntry,
    isBlacklisted,
    removeBlacklistEntry,
    type BlacklistEntry,
    type ListingSnapshot,
} from "../matching";

const BLACKLIST_KEY = "blacklist";

export async function getBlacklist(): Promise<BlacklistEntry[]> {
    return (await getFromStorage<BlacklistEntry[]>(BLACKLIST_KEY)) ?? [];
}

export async function setBlacklist(entries: readonly BlacklistEntry[]): Promise<void> {
    await setInStorage(BLACKLIST_KEY, [...entries]);
}

export async function clearBlacklist(): Promise<void> {
    await setBlacklist([]);
}

export async function addOrReplaceBlacklistEntry(listing: ListingSnapshot): Promise<void> {
    await setBlacklist(addBlacklistEntry(await getBlacklist(), listing));
}

export async function removeBlacklistUrls(urls: string | readonly string[]): Promise<void> {
    const entries = await getBlacklist();
    const next = [urls].flat()
        .reduce((current, url) => removeBlacklistEntry(current, url), entries);

    await setBlacklist(next);
}

export async function toggleBlacklistListing(listing: ListingSnapshot): Promise<boolean> {
    const entries = await getBlacklist();
    const active = isBlacklisted(entries, listing.url);

    await setBlacklist(
        active
            ? removeBlacklistEntry(entries, listing.url)
            : addBlacklistEntry(entries, listing),
    );

    return !active;
}

export async function toggleBlacklistListings(
    listings: readonly ListingSnapshot[],
): Promise<boolean> {
    const entries = await getBlacklist();
    const anyActive = listings.some(listing => isBlacklisted(entries, listing.url));

    await setBlacklist(
        anyActive
            ? listings.reduce((current, listing) => removeBlacklistEntry(current, listing.url), entries)
            : listings.reduce((current, listing) => addBlacklistEntry(current, listing), entries),
    );

    return !anyActive;
}
