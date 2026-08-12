import { extractSharedFilterParams, removeSharedFilterParams } from "../../features/filters/searchParams";
import { createStorageRepository } from "../../platform/repository";
import { isPlainObject } from "../../utils/types";

const DYNAMIC_PARAMS = ["lastsearchdate", "page", "pageNumber"];
const MAX_RECENT_SEARCHES = 24;

export interface ExtensionRecentSearch {
    filterParams: string;
    title: string;
    updatedAt: number;
    url: string;
}

function normalizeSearchUrl(value: string, includeCustomFilters: boolean): string | undefined {
    try {
        const url = new URL(value, window.location.origin);

        for (const key of DYNAMIC_PARAMS) url.searchParams.delete(key);
        if (!includeCustomFilters) removeSharedFilterParams(url.searchParams);
        url.searchParams.sort();
        url.hash = "";
        return url.href;
    } catch {
        return undefined;
    }
}

function normalizeRecentSearch(value: unknown): ExtensionRecentSearch | undefined {
    if (!isPlainObject(value) ||
        typeof value.filterParams !== "string" ||
        typeof value.title !== "string" ||
        typeof value.updatedAt !== "number" ||
        typeof value.url !== "string") return undefined;

    const url = normalizeSearchUrl(value.url, true);
    if (!url) return undefined;

    return {
        filterParams: value.filterParams,
        title: value.title,
        updatedAt: value.updatedAt,
        url,
    };
}

const repository = createStorageRepository<ExtensionRecentSearch[]>({
    key: "recentSearches",
    version: 1,
    createDefault: () => [],
    normalize: value => Array.isArray(value)
        ? value.map(normalizeRecentSearch).filter((entry): entry is ExtensionRecentSearch => Boolean(entry))
        : [],
});

export function getRecentSearches(): Promise<ExtensionRecentSearch[]> {
    return repository.get();
}

export function getRecentSearchBaseUrl(search: ExtensionRecentSearch): string {
    return normalizeSearchUrl(search.url, false) ?? search.url;
}

export async function rememberRecentSearch(url: URL, title: string): Promise<void> {
    const filterParams = extractSharedFilterParams(url.searchParams).toString();
    const normalizedUrl = normalizeSearchUrl(url.href, true);
    if (!normalizedUrl || !filterParams) return;

    const recent: ExtensionRecentSearch = {
        filterParams,
        title,
        updatedAt: Date.now(),
        url: normalizedUrl,
    };
    await repository.update(searches => [
        recent,
        ...searches.filter(search => search.url !== recent.url),
    ].slice(0, MAX_RECENT_SEARCHES));
}
