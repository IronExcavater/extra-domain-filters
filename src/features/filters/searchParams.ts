import { getSettings, updateSettings, type Settings } from "../../shared/state/settings";

const PARAMS = {
    couldHaves: "edf-could",
    excludeKeywords: "edf-exclude",
    strataMax: "edf-strata-max",
    propertyTypes: "edf-exclude-types",
    hideNonMatches: "edf-hide-non-matches",
} as const;
let lastAppliedHref: string | undefined;

function parseList(value: string | null): string[] {
    return value?.split(",").map(item => item.trim()).filter(Boolean) ?? [];
}

function setList(params: URLSearchParams, key: string, values: readonly string[]): void {
    if (values.length === 0) params.delete(key);
    else params.set(key, values.join(","));
}

export async function applySharedFilterParams(url: URL): Promise<void> {
    const params = url.searchParams;
    if (!Object.values(PARAMS).some(key => params.has(key))) return;
    if (lastAppliedHref === url.href) return;
    lastAppliedHref = url.href;

    const current = await getSettings();
    const strata = Number(params.get(PARAMS.strataMax));
    await updateSettings({
        filters: {
            couldHaveRuleIds: params.has(PARAMS.couldHaves)
                ? parseList(params.get(PARAMS.couldHaves))
                : current.filters.couldHaveRuleIds,
            excludeKeywords: params.has(PARAMS.excludeKeywords)
                ? parseList(params.get(PARAMS.excludeKeywords))
                : current.filters.excludeKeywords,
            strataMaxDollars: Number.isFinite(strata) && strata >= 0
                ? strata
                : current.filters.strataMaxDollars,
            excludePropertyKeywords: params.has(PARAMS.propertyTypes)
                ? parseList(params.get(PARAMS.propertyTypes))
                : current.filters.excludePropertyKeywords,
            excludeWhenNoCouldHaveMatch: params.get(PARAMS.hideNonMatches) === "1",
        },
    }, current);
}

export function syncSharedFilterParams(settings: Settings): void {
    const url = createSharedFilterUrl(settings, new URL(window.location.href));

    if (url.href !== window.location.href) history.replaceState({}, "", url);
}

export function createSharedFilterUrl(
    settings: Pick<Settings, "filters">,
    base = new URL("https://www.domain.com.au/sale/"),
): URL {
    const url = new URL(base);
    const params = url.searchParams;
    setList(params, PARAMS.couldHaves, settings.filters.couldHaveRuleIds);
    setList(params, PARAMS.excludeKeywords, settings.filters.excludeKeywords);
    setList(params, PARAMS.propertyTypes, settings.filters.excludePropertyKeywords);
    if (settings.filters.strataMaxDollars >= 2000) params.delete(PARAMS.strataMax);
    else params.set(PARAMS.strataMax, String(settings.filters.strataMaxDollars));
    if (settings.filters.excludeWhenNoCouldHaveMatch) params.set(PARAMS.hideNonMatches, "1");
    else params.delete(PARAMS.hideNonMatches);

    return url;
}
