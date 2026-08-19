import { getSharedSearch } from "../../domain/searches/client";
import { getSettings, updateSettings, type Settings } from "../../state/settings";

const PARAMS = {
    couldHaves: "could",
    excludeKeywords: "exclude",
    strataMax: "strata-max",
    propertyTypes: "exclude-types",
    hideNonMatches: "hide-non-matches",
} as const;
const LEGACY_PARAMS = {
    couldHaves: "edf-could",
    excludeKeywords: "edf-exclude",
    strataMax: "edf-strata-max",
    propertyTypes: "edf-exclude-types",
    hideNonMatches: "edf-hide-non-matches",
} as const;
export const HOSTED_SHARE_PARAM = "share";
export const LEGACY_HOSTED_SHARE_PARAM = "edf-share";
let lastAppliedHref: string | undefined;
const hostedSearches = new Map<string, ReturnType<typeof getSharedSearch>>();

function parseList(value: string | null): string[] {
    return value?.split(",").map(item => item.trim()).filter(Boolean) ?? [];
}

function setList(params: URLSearchParams, key: string, values: readonly string[]): void {
    if (values.length === 0) params.delete(key);
    else params.set(key, values.join(","));
}

function getParam(params: URLSearchParams, key: keyof typeof PARAMS): string | null {
    return params.get(PARAMS[key]) ?? params.get(LEGACY_PARAMS[key]);
}

function hasParam(params: URLSearchParams, key: keyof typeof PARAMS): boolean {
    return params.has(PARAMS[key]) || params.has(LEGACY_PARAMS[key]);
}

export async function applySharedFilterParams(url: URL): Promise<void> {
    let params = url.searchParams;
    const hostedId = params.get(HOSTED_SHARE_PARAM) ?? params.get(LEGACY_HOSTED_SHARE_PARAM);
    if (hostedId) {
        const request = hostedSearches.get(hostedId) ?? getSharedSearch(hostedId);
        hostedSearches.set(hostedId, request);
        const hosted = await request;
        if (hosted) params = new URLSearchParams(hosted.params);
    }
    if (!Object.keys(PARAMS).some(key => hasParam(params, key as keyof typeof PARAMS))) return;
    if (lastAppliedHref === url.href) return;
    lastAppliedHref = url.href;

    const current = await getSettings();
    const strata = Number(getParam(params, "strataMax"));
    await updateSettings({
        filters: {
            couldHaveRuleIds: hasParam(params, "couldHaves")
                ? parseList(getParam(params, "couldHaves"))
                : current.filters.couldHaveRuleIds,
            excludeKeywords: hasParam(params, "excludeKeywords")
                ? parseList(getParam(params, "excludeKeywords"))
                : current.filters.excludeKeywords,
            strataMaxDollars: Number.isFinite(strata) && strata >= 0
                ? strata
                : current.filters.strataMaxDollars,
            excludePropertyKeywords: hasParam(params, "propertyTypes")
                ? parseList(getParam(params, "propertyTypes"))
                : current.filters.excludePropertyKeywords,
            excludeWhenNoCouldHaveMatch: getParam(params, "hideNonMatches") === "1",
        },
    }, current);
}

export function createSharedFilterParams(settings: Settings): URLSearchParams {
    const params = new URLSearchParams();
    writeSharedFilterParams(params, settings);
    return params;
}

export function extractSharedFilterParams(params: URLSearchParams): URLSearchParams {
    const extracted = new URLSearchParams();
    for (const key of Object.keys(PARAMS) as Array<keyof typeof PARAMS>) {
        for (const value of params.getAll(PARAMS[key])) extracted.append(PARAMS[key], value);
        if (!params.has(PARAMS[key])) {
            for (const value of params.getAll(LEGACY_PARAMS[key])) extracted.append(PARAMS[key], value);
        }
    }
    return extracted;
}

export function removeSharedFilterParams(params: URLSearchParams): void {
    for (const key of Object.values(PARAMS)) params.delete(key);
    for (const key of Object.values(LEGACY_PARAMS)) params.delete(key);
}

function writeSharedFilterParams(params: URLSearchParams, settings: Settings): void {
    setList(params, PARAMS.couldHaves, settings.filters.couldHaveRuleIds);
    setList(params, PARAMS.excludeKeywords, settings.filters.excludeKeywords);
    setList(params, PARAMS.propertyTypes, settings.filters.excludePropertyKeywords);
    if (settings.filters.strataMaxDollars >= 2000) params.delete(PARAMS.strataMax);
    else params.set(PARAMS.strataMax, String(settings.filters.strataMaxDollars));
    if (settings.filters.excludeWhenNoCouldHaveMatch) params.set(PARAMS.hideNonMatches, "1");
    else params.delete(PARAMS.hideNonMatches);
}

export function syncSharedFilterParams(settings: Settings): void {
    const url = new URL(window.location.href);
    const params = url.searchParams;
    writeSharedFilterParams(params, settings);

    if (url.href !== window.location.href) history.replaceState({}, "", url);
}
