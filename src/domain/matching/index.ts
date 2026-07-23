import type {
    BlacklistEntry,
    Settings,
} from "../../shared/state/settings";

export type { BlacklistEntry } from "../../shared/state/settings";

export interface PreferenceRule {
    id: string;
    label: string;
    pattern: RegExp;
}

export const PREFERENCES = [
    {
        id: "gym",
        label: "Gym",
        pattern: /gym|fitness.{0,10}cent(er|re)|exercise/i,
    },
    {
        id: "pool",
        label: "Pool",
        pattern: /pool|swimming|jacuzzi|hot.{0,10}tub/i,
    },
    {
        id: "spa",
        label: "Spa",
        pattern: /spa|sauna|steam.{0,10}room/i,
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
}

export type ExclusionReason = "none" | "blacklisted" | "filtered";

export interface ListingMatch {
    exclusionReason: ExclusionReason;
    matchedPreferences: PreferenceRule[];
}

const STRATA_PATTERN =
    /(?:strata|body corporate|owners corporation)[^\d]{0,80}\$?\s*(\d+(?:,\d{3})*(?:\.\d{1,2})?)/i;

function normalizeUrl(url: string): string {
    return url.replace(/\/+$/, "");
}

function hasUrl(entry: BlacklistEntry, url: string): boolean {
    return normalizeUrl(entry.url) === normalizeUrl(url);
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
    return entry.listing ?? {
        url: entry.url,
        title: entry.displayAddress ?? entry.url,
        text: "",
        displayAddress: entry.displayAddress,
        thumbnailUrl: entry.thumbnailUrl,
    };
}

function includesAny(
    text: string,
    keywords: readonly string[],
): boolean {
    const normalizedText = text.toLowerCase();

    return keywords.some(keyword => {
        const normalizedKeyword = keyword.trim().toLowerCase();

        return (
            normalizedKeyword !== "" &&
            normalizedText.includes(normalizedKeyword)
        );
    });
}

function exceedsStrataMax(
    text: string,
    maximum: number,
): boolean {
    if (maximum >= STRATA_MAX) return false;

    const match = text.match(STRATA_PATTERN);
    if (!match) return false;

    const amount = Number(match[1].replaceAll(",", ""));

    return Number.isFinite(amount) && amount > maximum;
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

export function matchListing(
    listing: ListingSnapshot,
    settings: Settings,
    blacklist: readonly BlacklistEntry[],
): ListingMatch {
    const text = `${listing.title}\n${listing.text}`;
    const filters = settings.filters;

    const matchedPreferences = PREFERENCES.filter(
        preference =>
            filters.couldHaveRuleIds.includes(preference.id) &&
            preference.pattern.test(text),
    );
    const excludesCouldHaveMismatch = filters.excludeWhenNoCouldHaveMatch &&
        filters.couldHaveRuleIds.length > 0 &&
        matchedPreferences.length === 0;
    const exclusionReason: ExclusionReason = isBlacklisted(blacklist, listing.url)
        ? "blacklisted"
        : includesAny(text, filters.excludeKeywords) ||
            exceedsStrataMax(text, filters.strataMaxDollars) ||
            matchesExcludedPropertyType(listing.propertyType, filters.excludePropertyKeywords) ||
            excludesCouldHaveMismatch
            ? "filtered"
            : "none";

    return {
        exclusionReason,
        matchedPreferences,
    };
}
