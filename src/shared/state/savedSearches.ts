import { getFromStorage, setInStorage } from "../platform/storage";
import type { FilterSettings } from "./settings";

const SAVED_SEARCH_FILTERS_KEY = "saved-search-filters";

export interface SavedSearchFilterMetadata {
    filters: FilterSettings;
    savedSearchId: string;
    updatedAt: number;
}

type SavedSearchFilters = Record<string, SavedSearchFilterMetadata>;

async function getAllSavedSearchFilters(): Promise<SavedSearchFilters> {
    return (await getFromStorage<SavedSearchFilters>(SAVED_SEARCH_FILTERS_KEY)) ?? {};
}

export async function getSavedSearchFilters(
    savedSearchId: string,
): Promise<SavedSearchFilterMetadata | undefined> {
    return (await getAllSavedSearchFilters())[savedSearchId];
}

export async function setSavedSearchFilters(
    savedSearchId: string,
    filters: FilterSettings,
): Promise<void> {
    await setInStorage(SAVED_SEARCH_FILTERS_KEY, {
        ...await getAllSavedSearchFilters(),
        [savedSearchId]: { filters, savedSearchId, updatedAt: Date.now() },
    });
}
