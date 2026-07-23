import type { SavedSearch } from "../../../domain/searches/savedSearches";

export interface SearchFilterSummary {
    categoryDetail: string;
    categoryKind: string;
    chips: string[];
    features: {
        bathrooms: string;
        bedrooms: string;
        parking: string;
    };
    inlineDetails: string[];
}

export function getSearchUrl(search: SavedSearch): URL {
    const url = new URL(search.url, window.location.origin);
    const params = new URLSearchParams(search.filterParams);

    for (const [key, value] of params) url.searchParams.set(key, value);

    return url;
}

export function getSearchTitle(search: SavedSearch): string {
    const url = getSearchUrl(search);
    const genericTitle = /^(?:\d+\+\s*)?(?:rental properties|real estate properties|properties)/i.test(search.title);

    if (!genericTitle && search.title.trim()) return search.title.trim();
    if (url.pathname.includes("/rent")) return "Rent";
    if (url.pathname.includes("/sale")) return "Sale";

    return search.title.trim() || "Search";
}

function formatCurrency(value: number): string {
    return new Intl.NumberFormat("en-AU", {
        currency: "AUD",
        maximumFractionDigits: 0,
        style: "currency",
    }).format(value);
}

function getFirstParam(params: URLSearchParams, keys: readonly string[]): string | undefined {
    for (const key of keys) {
        const value = params.get(key);
        if (value) return value;
    }

    return undefined;
}

function formatPriceRange(value: string | undefined): string | undefined {
    if (!value) return undefined;

    const [rawMin, rawMax] = value.split("-");
    const min = Number(rawMin);
    const max = Number(rawMax);

    if (Number.isFinite(max) && (!Number.isFinite(min) || min === 0)) return `under ${formatCurrency(max)}`;
    if (Number.isFinite(min) && !Number.isFinite(max)) return `${formatCurrency(min)}+`;
    if (Number.isFinite(min) && Number.isFinite(max)) return `${formatCurrency(min)} - ${formatCurrency(max)}`;

    return undefined;
}

function formatRoomValue(value: string | undefined): string {
    if (!value) return "Any";

    const [rawMin, rawMax] = value.split("-");
    if (rawMin && rawMin !== "0" && (!rawMax || rawMax === "any")) return `${rawMin}+`;
    if (rawMin && rawMax && rawMin !== rawMax) return `${rawMin}-${rawMax}`;

    return rawMin || "Any";
}

function toTitleCase(value: string): string {
    return value
        .replace(/[+/_-]+/g, " ")
        .split(/\s+/)
        .filter(Boolean)
        .map(word => word[0].toUpperCase() + word.slice(1).toLowerCase())
        .join(" ");
}

function getListParams(params: URLSearchParams, keys: readonly string[]): string[] {
    return keys
        .flatMap(key => params.getAll(key).flatMap(value => value.split(",")))
        .map(value => value.trim())
        .filter(Boolean);
}

function formatList(values: readonly string[], maxVisible = 5): string | undefined {
    const unique = [...new Set(values.map(toTitleCase))];

    if (unique.length === 0) return undefined;
    if (unique.length <= maxVisible) return unique.join(", ");

    return `${unique.slice(0, maxVisible).join(", ")} +${unique.length - maxVisible}`;
}

export function getFilterSummary(search: SavedSearch): SearchFilterSummary {
    const url = getSearchUrl(search);
    const params = url.searchParams;
    const categoryKind = url.pathname.includes("/rent")
        ? "For Rent"
        : url.pathname.includes("/sale")
            ? "For Sale"
            : "Search";
    const price = formatPriceRange(getFirstParam(params, ["price", "priceRange"]));
    const chips: string[] = [];
    const inlineDetails: string[] = [];
    const strataValue = params.get("strata-max") ?? params.get("edf-strata-max");
    const strataMax = strataValue === null ? Number.NaN : Number(strataValue);
    const propertyTypes = getListParams(params, ["propertyTypes", "property-types", "ptype"]);
    const excludedTypes = formatList(getListParams(params, ["exclude-types", "edf-exclude-types"]), 4);
    const includedKeywords = formatList(
        getListParams(params, ["keywords", "keyword", "include", "include-keywords"]),
        4,
    );
    const excludedKeywords = formatList(getListParams(params, ["exclude", "edf-exclude"]), 4);
    const preferences = formatList(getListParams(params, ["could", "edf-could"]), 4);
    const propertyTypeSummary = formatList(propertyTypes);

    if (propertyTypeSummary) inlineDetails.push(propertyTypeSummary);
    if (Number.isFinite(strataMax) && strataMax >= 0 && strataMax < 2000) {
        chips.push(`Strata under ${formatCurrency(strataMax)}`);
    }
    if (excludedTypes) chips.push(`Exclude types: ${excludedTypes}`);
    if (includedKeywords) chips.push(`Keywords: ${includedKeywords}`);
    if (excludedKeywords) chips.push(`Exclude: ${excludedKeywords}`);
    if (preferences) chips.push(`Preferences: ${preferences}`);
    if ((params.get("hide-non-matches") ?? params.get("edf-hide-non-matches")) === "1") {
        chips.push("Hiding non-matches");
    }

    return {
        categoryDetail: price ?? "",
        categoryKind,
        chips,
        features: {
            bathrooms: formatRoomValue(getFirstParam(params, ["bathrooms", "baths"])),
            bedrooms: formatRoomValue(getFirstParam(params, ["bedrooms", "beds"])),
            parking: formatRoomValue(getFirstParam(params, ["carspaces", "parking"])),
        },
        inlineDetails,
    };
}
