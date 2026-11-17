import { createStorageRepository } from "../../platform/repository";
import { findProfileEntry, type BlacklistProfile } from "./profiles";
import {
    addBlacklistEntry,
    isBlacklisted,
    removeBlacklistEntry,
    type BlacklistEntry,
    type ListingSnapshot,
} from "../matching";

const BLACKLIST_KEY = "blacklist";
const blacklistRepository = createStorageRepository<BlacklistEntry[]>({
    key: BLACKLIST_KEY,
    version: 1,
    createDefault: () => [],
    normalize: value => Array.isArray(value) ? value as BlacklistEntry[] : [],
});

export async function getBlacklist(): Promise<BlacklistEntry[]> {
    return blacklistRepository.get();
}

export async function setBlacklist(entries: readonly BlacklistEntry[]): Promise<void> {
    await blacklistRepository.set([...entries]);
}

export async function addOrReplaceBlacklistEntry(listing: ListingSnapshot): Promise<void> {
    await blacklistRepository.update(entries => addBlacklistEntry(entries, listing));
}

export async function removeBlacklistUrls(urls: string | readonly string[]): Promise<void> {
    await blacklistRepository.update(entries =>
        [urls].flat().reduce(
            (current, url) => removeBlacklistEntry(current, url),
            entries,
        ),
    );
}

export async function toggleBlacklistListing(listing: ListingSnapshot): Promise<boolean> {
    let nextActive = false;
    await blacklistRepository.update(entries => {
        const active = isBlacklisted(entries, listing.url);
        nextActive = !active;
        return active
            ? removeBlacklistEntry(entries, listing.url)
            : addBlacklistEntry(entries, listing);
    });
    return nextActive;
}

export async function toggleBlacklistListings(
    listings: readonly ListingSnapshot[],
): Promise<boolean> {
    let nextActive = false;
    await blacklistRepository.update(entries => {
        const anyActive = listings.some(listing => isBlacklisted(entries, listing.url));
        nextActive = !anyActive;
        return anyActive
            ? listings.reduce((current, listing) => removeBlacklistEntry(current, listing.url), entries)
            : listings.reduce((current, listing) => addBlacklistEntry(current, listing), entries);
    });
    return nextActive;
}

/**
 * Blacklists an agency or agent, or lifts it when it already is (under whichever URL it was
 * saved, e.g. from its profile page or from a listing card). Returns whether it is now hidden.
 */
export async function toggleBlacklistProfile(
    profile: BlacklistProfile,
    details: { thumbnailUrl?: string } = {},
): Promise<boolean> {
    let nextActive = false;
    await blacklistRepository.update(entries => {
        const existing = findProfileEntry(entries, profile);
        nextActive = !existing;
        return existing
            ? removeBlacklistEntry(entries, existing.url)
            : addBlacklistEntry(entries, {
                displayAddress: profile.name,
                text: "",
                thumbnailUrl: details.thumbnailUrl,
                title: profile.name,
                url: profile.url,
            });
    });
    return nextActive;
}
