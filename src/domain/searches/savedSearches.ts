import { createStorageRepository } from "../../shared/platform/repository";
import { isOneOf, isPlainObject } from "../../shared/utils/types";

export type SearchNotificationFrequency = "daily" | "none" | "weekly";

const SEARCH_NOTIFICATION_FREQUENCIES = ["daily", "none", "weekly"] as const;

export interface SavedSearch {
    createdAt: number;
    domainId?: string;
    filterParams: string;
    id: string;
    newListingCount?: number;
    notificationFrequency: SearchNotificationFrequency;
    title: string;
    updatedAt: number;
    url: string;
}

export interface SaveSearchInput {
    domainId?: string;
    filterParams: string;
    id?: string;
    newListingCount?: number;
    notificationFrequency: SearchNotificationFrequency;
    title: string;
    url: string;
}

export function normalizeSavedSearch(value: unknown): SavedSearch | undefined {
    if (!isPlainObject(value)) return undefined;
    if (
        typeof value.createdAt !== "number" ||
        typeof value.filterParams !== "string" ||
        typeof value.id !== "string" ||
        !isOneOf(value.notificationFrequency, SEARCH_NOTIFICATION_FREQUENCIES) ||
        typeof value.title !== "string" ||
        typeof value.updatedAt !== "number" ||
        typeof value.url !== "string"
    ) return undefined;

    return {
        createdAt: value.createdAt,
        domainId: typeof value.domainId === "string" ? value.domainId : undefined,
        filterParams: value.filterParams,
        id: value.id,
        newListingCount: typeof value.newListingCount === "number" &&
            Number.isSafeInteger(value.newListingCount) && value.newListingCount >= 0
            ? value.newListingCount
            : undefined,
        notificationFrequency: value.notificationFrequency,
        title: value.title,
        updatedAt: value.updatedAt,
        url: value.url,
    };
}

const repository = createStorageRepository<SavedSearch[]>({
    key: "savedSearches",
    version: 1,
    createDefault: () => [],
    normalize: value => Array.isArray(value)
        ? value.map(normalizeSavedSearch).filter((entry): entry is SavedSearch => Boolean(entry))
        : [],
});

export function getSavedSearches(): Promise<SavedSearch[]> {
    return repository.get();
}

export async function saveSearch(input: SaveSearchInput): Promise<SavedSearch> {
    const now = Date.now();
    let saved: SavedSearch | undefined;
    await repository.update(searches => {
        const id = input.id ?? (input.domainId ? `domain:${input.domainId}` : crypto.randomUUID());
        const current = searches.find(search => search.id === id);
        saved = {
            ...input,
            createdAt: current?.createdAt ?? now,
            id,
            updatedAt: now,
        };
        return [...searches.filter(search => search.id !== id), saved];
    });
    if (!saved) throw new Error("Could not save the search");
    return saved;
}

export async function removeSavedSearch(id: string): Promise<void> {
    await repository.update(searches => searches.filter(search => search.id !== id));
}

export async function setSavedSearches(searches: readonly SavedSearch[]): Promise<void> {
    await repository.set([...searches]);
}
