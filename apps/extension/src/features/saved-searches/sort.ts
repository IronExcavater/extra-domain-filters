import type { SavedSearch } from "../../domain/searches/savedSearches";

export type SavedSearchSort = "newest" | "oldest" | "title";
export type SavedSearchType = "all" | "buy" | "rent";

export function getSavedSearchType(search: SavedSearch): Exclude<SavedSearchType, "all"> {
    return new URL(search.url, window.location.origin).pathname.includes("/rent")
        ? "rent"
        : "buy";
}

export function sortSavedSearches(
    searches: readonly SavedSearch[],
    sort: SavedSearchSort,
): SavedSearch[] {
    return [...searches].sort((first, second) => {
        if (sort === "oldest") return first.updatedAt - second.updatedAt;
        if (sort === "title") return first.title.localeCompare(second.title);
        return second.updatedAt - first.updatedAt;
    });
}
