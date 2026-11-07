import {
    getBlacklistListing,
    type BlacklistEntry,
} from "../../domain/matching";

export type BlacklistFilter = "all" | "buy" | "rent";
export type BlacklistSort = "address" | "newest" | "oldest" | "price-asc" | "price-desc";

export type StableNewestOrder = Map<string, number>;

export function updateStableNewestOrder(
    order: StableNewestOrder,
    entries: readonly BlacklistEntry[],
): void {
    if (order.size === 0) {
        [...entries]
            .sort((first, second) => second.addedAt - first.addedAt)
            .forEach((entry, index) => order.set(getBlacklistListing(entry).url, index));
        return;
    }

    let next = Math.min(...order.values()) - 1;
    for (const entry of entries) {
        const url = getBlacklistListing(entry).url;
        if (order.has(url)) continue;
        order.set(url, next);
        next -= 1;
    }
}

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
    newestOrder?: ReadonlyMap<string, number>,
): BlacklistEntry[] {
    return [...entries].sort((first, second) => {
        if (sort === "oldest") return first.addedAt - second.addedAt;
        if (sort === "price-asc") return getPrice(first) - getPrice(second);
        if (sort === "price-desc") return getPrice(second) - getPrice(first);
        if (sort === "address") {
            return (getBlacklistListing(first).displayAddress ?? "")
                .localeCompare(getBlacklistListing(second).displayAddress ?? "");
        }

        if (newestOrder) {
            return (newestOrder.get(getBlacklistListing(first).url) ?? Number.MAX_SAFE_INTEGER)
                - (newestOrder.get(getBlacklistListing(second).url) ?? Number.MAX_SAFE_INTEGER);
        }
        return second.addedAt - first.addedAt;
    });
}
