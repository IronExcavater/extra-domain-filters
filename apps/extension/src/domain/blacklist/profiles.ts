import type { BlacklistEntry, ListingSnapshot } from "../matching";

export type ProfileKind = "agency" | "agent";

/** A blacklisted agency or agent. It lives in the blacklist keyed by its Domain profile URL. */
export interface BlacklistProfile {
    id: string;
    kind: ProfileKind;
    name: string;
    url: string;
}

const PROFILE_PATH = /^\/(real-estate-agencies|real-estate-agent)\/([a-z0-9-]+?)-(\d+)\/?$/i;

function titleCase(slug: string): string {
    return slug.split("-").filter(Boolean).map(word => word[0].toUpperCase() + word.slice(1)).join(" ");
}

/** Domain profile URLs end in the agency/agent id: /real-estate-agencies/raywhiteyamba-14981/. */
export function parseProfileUrl(value: string, name?: string): BlacklistProfile | undefined {
    let url: URL;
    try {
        url = new URL(value, "https://www.domain.com.au");
    } catch {
        return undefined;
    }
    const match = url.pathname.match(PROFILE_PATH);
    if (!match) return undefined;
    const [, section, slug, id] = match;
    return {
        id,
        kind: section.toLowerCase() === "real-estate-agencies" ? "agency" : "agent",
        // Synced devices only receive the URL; the slug reads well enough for agents.
        name: name?.trim() || titleCase(slug),
        url: `https://www.domain.com.au/${section.toLowerCase()}/${slug.toLowerCase()}-${id}/`,
    };
}

export function isProfileEntry(entry: BlacklistEntry): boolean {
    return PROFILE_PATH.test(new URL(entry.url, "https://www.domain.com.au").pathname);
}

const activeProfiles = new WeakMap<readonly BlacklistEntry[], BlacklistProfile[]>();

export function getBlacklistedProfiles(entries: readonly BlacklistEntry[]): BlacklistProfile[] {
    let profiles = activeProfiles.get(entries);
    if (!profiles) {
        profiles = entries.flatMap(entry => {
            const profile = entry.removedAt ? undefined : parseProfileUrl(entry.url, entry.displayAddress);
            return profile ? [profile] : [];
        });
        activeProfiles.set(entries, profiles);
    }
    return profiles;
}

function normalizeName(name: string): string {
    return name.trim().replace(/\s+/g, " ").toLowerCase();
}

/** The blacklisted agency or agent behind a listing, if any. */
export function findBlacklistedProfile(
    entries: readonly BlacklistEntry[],
    listing: ListingSnapshot,
): BlacklistProfile | undefined {
    const profiles = getBlacklistedProfiles(entries);
    if (profiles.length === 0) return undefined;
    const agentNames = new Set(listing.agentNames?.map(normalizeName));
    return profiles.find(profile => profile.kind === "agency"
        ? listing.agencyId === profile.id
        : listing.agentIds?.includes(profile.id) || agentNames.has(normalizeName(profile.name)));
}
