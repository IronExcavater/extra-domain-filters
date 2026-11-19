import type { BlacklistEntry, ListingSnapshot } from "../matching";

export type ProfileKind = "agency" | "agent";

/** A blacklisted agency or agent. It lives in the blacklist keyed by its Domain profile URL. */
export interface BlacklistProfile {
    /** Domain's id; agents hidden from a listing card (which only names them) use their name. */
    id: string;
    kind: ProfileKind;
    name: string;
    url: string;
}

// Agencies always end in their id (/real-estate-agencies/raywhiteyamba-14981/). Agents do on
// their profile page; an agent hidden from a listing card is keyed by name alone.
const PROFILE_PATH = /^\/(real-estate-agencies|real-estate-agent)\/([a-z0-9-]+?)(?:-(\d+))?\/?$/i;

function titleCase(slug: string): string {
    return slug.split("-").filter(Boolean).map(word => word[0].toUpperCase() + word.slice(1)).join(" ");
}

function normalizeName(name: string): string {
    return name.trim().replace(/\s+/g, " ").toLowerCase();
}

function slugify(name: string): string {
    return normalizeName(name).replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "") || "agent";
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
    const kind: ProfileKind = section.toLowerCase() === "real-estate-agencies" ? "agency" : "agent";
    if (kind === "agency" && !id) return undefined;
    const displayName = name?.trim() || titleCase(slug);
    return {
        id: id ?? `name:${normalizeName(displayName)}`,
        kind,
        // Synced devices only receive the URL; the slug reads well enough for agents.
        name: displayName,
        url: `https://www.domain.com.au/${section.toLowerCase()}/${slug.toLowerCase()}${id ? `-${id}` : ""}/`,
    };
}

/** A profile for an agency (by id) or agent (by name) seen on a listing card. */
export function createProfile(kind: ProfileKind, name: string, id?: string): BlacklistProfile {
    const section = kind === "agency" ? "real-estate-agencies" : "real-estate-agent";
    return parseProfileUrl(`/${section}/${slugify(name)}${id ? `-${id}` : ""}/`, name)!;
}

export function isProfileEntry(entry: BlacklistEntry): boolean {
    return parseProfileUrl(entry.url) !== undefined;
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

function isSameProfile(profile: BlacklistProfile, other: BlacklistProfile): boolean {
    if (profile.kind !== other.kind) return false;
    if (profile.id === other.id) return true;
    return profile.kind === "agent" && normalizeName(profile.name) === normalizeName(other.name);
}

/** The blacklist entry already standing for this agency or agent, whatever URL it was saved under. */
export function findProfileEntry(
    entries: readonly BlacklistEntry[],
    profile: BlacklistProfile,
): BlacklistProfile | undefined {
    return getBlacklistedProfiles(entries).find(existing => isSameProfile(existing, profile));
}

/** The blacklisted agency or agent behind a listing, if any. */
export function findBlacklistedProfile(
    entries: readonly BlacklistEntry[],
    listing: ListingSnapshot,
): BlacklistProfile | undefined {
    const profiles = getBlacklistedProfiles(entries);
    if (profiles.length === 0) return undefined;
    const agentNames = new Set(listing.agentNames?.map(normalizeName));
    const agencyName = listing.agencyName && normalizeName(listing.agencyName);
    return profiles.find(profile => profile.kind === "agency"
        ? listing.agencyId ? listing.agencyId === profile.id : agencyName === normalizeName(profile.name)
        : listing.agentIds?.includes(profile.id) || agentNames.has(normalizeName(profile.name)));
}
