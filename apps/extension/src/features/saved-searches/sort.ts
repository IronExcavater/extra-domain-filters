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
        // Editing an alert updates `updatedAt`; using it for the collection order made the
        // card jump while the user was still interacting with it. Creation time is the stable
        // meaning of newest/oldest and therefore only changes when a search is actually added.
        if (sort === "oldest") {
            return first.createdAt - second.createdAt || first.id.localeCompare(second.id);
        }
        if (sort === "title") {
            return first.title.localeCompare(second.title) || first.createdAt - second.createdAt;
        }
        return second.createdAt - first.createdAt || first.id.localeCompare(second.id);
    });
}
