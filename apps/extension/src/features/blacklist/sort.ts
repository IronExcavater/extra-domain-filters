import {
    getBlacklistListing,
    type BlacklistEntry,
} from "../../domain/matching";

export type BlacklistFilter = "all" | "buy" | "rent";
export type BlacklistSort = "address" | "newest" | "oldest" | "price-asc" | "price-desc";

export function isRentalEntry(entry: BlacklistEntry): boolean {
    const listing = getBlacklistListing(entry);

    return /\b(?:per week|weekly|p\.?w\.?|per month|p\.?c\.?m\.?)\b/i.test(
        `${listing.price ?? ""} ${listing.text}`,
    );
}

export function filterBlacklistEntries(
    entries: readonly BlacklistEntry[],
    filter: BlacklistFilter,
): BlacklistEntry[] {
    if (filter === "all") return [...entries];

    return entries.filter(entry => filter === "rent" ? isRentalEntry(entry) : !isRentalEntry(entry));
}

function getPrice(entry: BlacklistEntry): number {
    const value = getBlacklistListing(entry).price
        ?.replaceAll(",", "")
        .match(/\d+(?:\.\d+)?/)?.[0];

    return value ? Number(value) : Number.POSITIVE_INFINITY;
}

export function sortBlacklistEntries(
    entries: readonly BlacklistEntry[],
    sort: BlacklistSort,
): BlacklistEntry[] {
    return [...entries].sort((first, second) => {
        if (sort === "oldest") return first.addedAt - second.addedAt;
        if (sort === "price-asc") return getPrice(first) - getPrice(second);
        if (sort === "price-desc") return getPrice(second) - getPrice(first);
        if (sort === "address") {
            return (getBlacklistListing(first).displayAddress ?? "")
                .localeCompare(getBlacklistListing(second).displayAddress ?? "");
        }

        return second.addedAt - first.addedAt;
    });
}
