import { isOneOf, isPlainObject } from "../../shared/utils/types";

export type TelemetryArea = "authentication" | "blacklist" | "filters" | "lifecycle" | "settings" | "sync";

const TELEMETRY_AREAS = ["authentication", "blacklist", "filters", "lifecycle", "settings", "sync"] as const;
const FEATURE_NAMES = [
    "blacklist",
    "could_haves",
    "exclude_keywords",
    "filter_share",
    "map_matches",
    "property_type_exclusions",
    "saved_search_delete",
    "saved_search_frequency",
    "saved_search_share",
    "settings",
    "strata_fees",
    "support_link",
] as const;
const SYNC_AREAS = ["blacklist", "settings"] as const;
const SYNC_RESULTS = ["failure", "success"] as const;
const SYNC_DURATION_BUCKETS = ["under_250ms", "under_1s", "under_5s", "over_5s"] as const;
const DIAGNOSTIC_CODES = ["configuration", "network", "permission", "storage", "unexpected"] as const;

export type TelemetryEventInput =
    | {
        name: "extension_started";
        version: string;
    }
    | {
        feature:
            | "blacklist"
            | "could_haves"
            | "exclude_keywords"
            | "filter_share"
            | "map_matches"
            | "property_type_exclusions"
            | "saved_search_delete"
            | "saved_search_frequency"
            | "saved_search_share"
            | "settings"
            | "strata_fees"
            | "support_link";
        name: "feature_used";
    }
    | {
        area: "blacklist" | "settings";
        durationBucket: "under_250ms" | "under_1s" | "under_5s" | "over_5s";
        name: "sync_completed";
        result: "failure" | "success";
    }
    | {
        area: TelemetryArea;
        code: "configuration" | "network" | "permission" | "storage" | "unexpected";
        name: "diagnostic";
    };

export interface TelemetryEvent {
    createdAt: number;
    id: string;
    input: TelemetryEventInput;
}

export function isTelemetryEventInput(value: unknown): value is TelemetryEventInput {
    if (!isPlainObject(value)) return false;
    const event = value;

    switch (event.name) {
        case "extension_started":
            return typeof event.version === "string";
        case "feature_used":
            return isOneOf(event.feature, FEATURE_NAMES);
        case "sync_completed":
            return isOneOf(event.area, SYNC_AREAS) &&
                isOneOf(event.result, SYNC_RESULTS) &&
                isOneOf(event.durationBucket, SYNC_DURATION_BUCKETS);
        case "diagnostic":
            return isOneOf(event.area, TELEMETRY_AREAS) &&
                isOneOf(event.code, DIAGNOSTIC_CODES);
        default:
            return false;
    }
}
