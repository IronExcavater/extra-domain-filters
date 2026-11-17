import type {
    BlacklistEntry,
    FilterSettings,
    Settings,
} from "../../state/settings";

import { findBlacklistedProfile, type BlacklistProfile } from "../blacklist/profiles";
import { normalizeListingUrl } from "../listings/url";

export type { BlacklistEntry } from "../../state/settings";

export interface PreferenceRule {
    id: string;
    label: string;
    pattern: RegExp;
}

export const PREFERENCES = [
    {
        id: "gym",
        label: "Gym",
        pattern: /\bgym\b|fitness.{0,10}cent(er|re)/i,
    },
    {
        id: "pool",
        label: "Pool",
        pattern: /pool|swimming|jacuzzi|hot.{0,10}tub/i,
    },
    {
        id: "spa",
        label: "Spa",
        pattern: /\bspas?\b|sauna|steam.{0,10}room/i,
    },
    {
        id: "dishwasher",
        label: "Dishwasher",
        pattern: /dishwasher/i,
    },
    {
        id: "washing",
        label: "Washing & Dryer",
        pattern: /dryer|washing.{0,10}machine/i,
    },
    {
        id: "glazing",
        label: "Double Glazed Windows",
        pattern: /double.{0,10}glaz|glazed.{0,10}window|soundproof/i,
    },
    {
        id: "electric-stove",
        label: "Electric Stove",
        pattern: /(electric|induction).{0,10}(stove|cook\s?top)/i,
    },
] satisfies PreferenceRule[];

/** A could-have the user can tick in the filters: a built-in (its id is a PREFERENCES id) or their own. */
export interface CouldHaveOption {
    id: string;
    label: string;
}

/** The starting list, and what "Reset" goes back to. */
export const DEFAULT_COULD_HAVES: readonly CouldHaveOption[] = PREFERENCES.map(({ id, label }) => ({ id, label }));

const REGEX_SPECIAL = /[.*+?^${}()|[\]\\]/g;
const CUSTOM_PREFIX = "custom:";
const phraseRules = new Map<string, PreferenceRule>();

function tidyLabel(text: string): string {
    const label = text.trim().replace(/\s+/g, " ");
    return label.charAt(0).toUpperCase() + label.slice(1);
}

/** A user's could-have, from what they typed. Undefined when there is nothing to add. */
export function createCouldHave(text: string): CouldHaveOption | undefined {
    const label = tidyLabel(text).slice(0, 60);
    if (!label) return undefined;
    return { id: `${CUSTOM_PREFIX}${label.toLowerCase()}`, label };
}

/** Custom ids carry their phrase, so a shared link can rebuild the option it names. */
export function couldHaveFromId(id: string): CouldHaveOption | undefined {
    const builtIn = DEFAULT_COULD_HAVES.find(option => option.id === id);
    if (builtIn) return { ...builtIn };
    return id.startsWith(CUSTOM_PREFIX) ? createCouldHave(id.slice(CUSTOM_PREFIX.length)) : undefined;
}

/**
 * A typed could-have matches its phrase case-insensitively from a word start, so "pool"
 * won't match "whirlpool". "Ocean view / sea view" matches either phrase.
 */
function phraseRule(option: CouldHaveOption): PreferenceRule {
    const cached = phraseRules.get(option.id);
    if (cached && cached.label === option.label) return cached;
    const phrases = option.label.split("/").map(part => part.trim()).filter(Boolean);
    const body = phrases
        .map(phrase => phrase.replace(REGEX_SPECIAL, "\\$&").replace(/\s+/g, "\\s+"))
        .join("|");
    const rule = { id: option.id, label: option.label, pattern: new RegExp(`(?<!\\w)(?:${body})`, "i") };
    phraseRules.set(option.id, rule);
    return rule;
}

export function getCouldHaveRule(option: CouldHaveOption): PreferenceRule {
    const builtIn = PREFERENCES.find(preference => preference.id === option.id);
    return builtIn ? { ...builtIn, label: option.label } : phraseRule(option);
}

/** Older settings kept typed could-haves as one comma-separated string. */
export function parseCustomPreferences(text: string): CouldHaveOption[] {
    const seen = new Set<string>();
    return text.split(",").flatMap(part => {
        const option = createCouldHave(part);
        if (!option || seen.has(option.id)) return [];
        seen.add(option.id);
        return [option];
    });
}

/** Every could-have the user has ticked. */
export function getSelectedPreferences(filters: FilterSettings): PreferenceRule[] {
    const selected = new Set(filters.couldHaveRuleIds);
    return filters.couldHaveOptions.filter(option => selected.has(option.id)).map(getCouldHaveRule);
}

export const STRATA_MAX = 2000;

export interface ListingSnapshot {
    url: string;
    title: string;
    text: string;
    displayAddress?: string;
    features?: {
        bathrooms?: string;
        bedrooms?: string;
        parking?: string;
    };
    price?: string;
    thumbnailUrl?: string;
    imageUrls?: string[];
    propertyType?: string;
    /** Domain agency id (the number ending its profile URL). */
    agencyId?: string;
    agencyName?: string;
    agentIds?: string[];
    agentNames?: string[];
}

export type ExclusionReason = "none" | "blacklisted" | "filtered";

export interface ListingMatch {
    /** A blacklisted agency/agent hides the listing like a filter (it can be shown anyway). */
    blacklistedProfile?: BlacklistProfile;
    exclusionReason: ExclusionReason;
    filterMatched: boolean;
    /** Why the filters hide it, in words ("Mentions “studio”"); empty when they don't. */
    filterReasons: string[];
    matchedPreferences: PreferenceRule[];
}

export interface ListingMatchPolicy {
    isFilteredListingRevealed?(url: string): boolean;
}

const STRATA_PATTERN =
    /(?:strata|body corporate|owners corporation)[^\d]{0,80}\$?\s*(\d+(?:,\d{3})*(?:\.\d{1,2})?)/i;

function hasUrl(entry: BlacklistEntry, url: string): boolean {
    return normalizeListingUrl(entry.url) === normalizeListingUrl(url);
}

export function isBlacklisted(
    entries: readonly BlacklistEntry[],
    url: string,
): boolean {
    return entries.some(entry => hasUrl(entry, url) && !entry.removedAt);
}

export function addBlacklistEntry(
    entries: readonly BlacklistEntry[],
    listing: ListingSnapshot,
): BlacklistEntry[] {
    const existing = entries.find(entry => hasUrl(entry, listing.url));
    if (existing) {
        return entries.map(entry =>
            hasUrl(entry, listing.url)
                ? {
                    ...entry,
                    removedAt: undefined,
                    displayAddress: listing.displayAddress ?? entry.displayAddress,
                    thumbnailUrl: listing.thumbnailUrl ?? entry.thumbnailUrl,
                    listing: { ...entry.listing, ...listing },
                }
                : entry,
        );
    }

    const entry: BlacklistEntry = {
        url: listing.url,
        addedAt: Date.now(),
        displayAddress: listing.displayAddress ?? listing.title,
        thumbnailUrl: listing.thumbnailUrl,
        listing,
    };

    return [...entries, entry];
}

export function removeBlacklistEntry(
    entries: readonly BlacklistEntry[],
    url: string,
): BlacklistEntry[] {
    return entries.map(entry =>
        hasUrl(entry, url) ? { ...entry, removedAt: Date.now() } : entry
    );
}

export function getBlacklistListing(
    entry: BlacklistEntry,
): ListingSnapshot {
    if (entry.listing) {
        return {
            ...entry.listing,
            displayAddress: entry.listing.displayAddress ?? entry.displayAddress,
            thumbnailUrl: entry.listing.thumbnailUrl ?? entry.thumbnailUrl,
        };
    }
    return {
        url: entry.url,
        title: entry.displayAddress ?? entry.url,
        text: "",
        displayAddress: entry.displayAddress,
        thumbnailUrl: entry.thumbnailUrl,
    };
}

function findKeyword(
    text: string,
    keywords: readonly string[],
): string | undefined {
    const normalizedText = text.toLowerCase();

    return keywords.find(keyword => {
        const normalizedKeyword = keyword.trim().toLowerCase();

        return (
            normalizedKeyword !== "" &&
            normalizedText.includes(normalizedKeyword)
        );
    })?.trim();
}

/** The listing's strata fee when it is above the user's maximum. */
function strataOverMax(
    text: string,
    maximum: number,
): number | undefined {
    if (maximum >= STRATA_MAX) return undefined;

    const match = text.match(STRATA_PATTERN);
    if (!match) return undefined;

    const amount = Number(match[1].replaceAll(",", ""));

    return Number.isFinite(amount) && amount > maximum ? amount : undefined;
}

function matchesExcludedPropertyType(
    propertyType: string | undefined,
    excludePropertyKeywords: readonly string[],
): boolean {
    if (!propertyType || excludePropertyKeywords.length === 0) return false;

    const normalizedType = propertyType.trim().toLowerCase();
    const typeAliases = new Set(
        normalizedType
            .split(/\s*(?:&|\/|,|\band\b)\s*/i)
            .map(part => part.trim())
            .filter(Boolean),
    );

    return excludePropertyKeywords.some(keyword => {
        const normalizedKeyword = keyword.trim().toLowerCase();
        if (normalizedKeyword === normalizedType || typeAliases.has(normalizedKeyword)) return true;

        return normalizedKeyword
            .split(/\s*(?:&|\/|,|\band\b)\s*/i)
            .map(part => part.trim())
            .filter(Boolean)
            .some(part => part === normalizedType || typeAliases.has(part));
    });
}

function formatDollars(amount: number): string {
    return amount.toLocaleString("en-AU", { currency: "AUD", maximumFractionDigits: 0, style: "currency" });
}

export function matchListing(
    listing: ListingSnapshot,
    settings: Settings,
    blacklist: readonly BlacklistEntry[],
    policy: ListingMatchPolicy = {},
): ListingMatch {
    const text = `${listing.title}\n${listing.text}`;
    const filters = settings.filters;

    const selectedPreferences = getSelectedPreferences(filters);
    const matchedPreferences = selectedPreferences.filter(preference => preference.pattern.test(text));
    const excludesCouldHaveMismatch = filters.excludeWhenNoCouldHaveMatch &&
        selectedPreferences.length > 0 &&
        matchedPreferences.length === 0;
    const blacklistedProfile = findBlacklistedProfile(blacklist, listing);
    const keyword = findKeyword(text, filters.excludeKeywords);
    const strata = strataOverMax(text, filters.strataMaxDollars);
    const excludedType = matchesExcludedPropertyType(listing.propertyType, filters.excludePropertyKeywords)
        ? listing.propertyType
        : undefined;
    const filterReasons = [
        blacklistedProfile && `${blacklistedProfile.kind === "agency" ? "Agency" : "Agent"}: ${blacklistedProfile.name}`,
        keyword && `Mentions “${keyword}”`,
        strata === undefined ? undefined : `Strata ${formatDollars(strata)} a quarter`,
        excludedType,
        excludesCouldHaveMismatch ? "None of your could-haves" : undefined,
    ].filter((reason): reason is string => typeof reason === "string" && reason !== "");
    const filterMatched = filterReasons.length > 0;
    const exclusionReason: ExclusionReason = isBlacklisted(blacklist, listing.url)
        ? "blacklisted"
        : filterMatched && !policy.isFilteredListingRevealed?.(listing.url)
            ? "filtered"
            : "none";

    return {
        blacklistedProfile,
        exclusionReason,
        filterMatched,
        filterReasons,
        matchedPreferences,
    };
}
