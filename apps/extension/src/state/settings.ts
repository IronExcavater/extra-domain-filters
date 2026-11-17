import {
    createCouldHave,
    DEFAULT_COULD_HAVES,
    parseCustomPreferences,
    STRATA_MAX,
    type CouldHaveOption,
    type ListingSnapshot,
} from "../domain/matching";
import { createStorageRepository } from "../platform/repository";
import { applyPatch, isPlainObject, type DeepPartial } from "../utils/types";

export interface Settings {
    flags: FlagSettings;
    filters: FilterSettings;
    queue: QueueSettings;
    savedSearches: SavedSearchSettings;
    cache: CacheSettings;
    sync: SyncSettings;
    telemetry: TelemetrySettings;
}

export interface FlagSettings {
    enableExtension: boolean;
    enableBlacklist: boolean;
    enableAdBlocking: boolean;
    enableMapPins: boolean;
    enableCarouselControls: boolean;
}

export interface FilterSettings {
    excludeKeywords: string[];
    strataMaxDollars: number;
    /** The could-haves offered in the filters, in order; the user can add, remove and reset them. */
    couldHaveOptions: CouldHaveOption[];
    /** Which of them are ticked. */
    couldHaveRuleIds: string[];
    /** @deprecated Typed could-haves before they became options; migrated into them (v4). */
    customPreferenceText: string;
    excludePropertyKeywords: string[];
    enabled: FilterFeatureSettings;
    excludeWhenNoCouldHaveMatch: boolean;
    enrichListingDetails: boolean;
}

export interface FilterFeatureSettings {
    couldHaves: boolean;
    excludeKeywords: boolean;
    strataFees: boolean;
    propertyTypes: boolean;
}

export interface QueueSettings {
    enrichmentPace: EnrichmentPace;
}

export interface CacheSettings {
    ttlMs: number;
}

export type EnrichmentPace = "efficient" | "balanced" | "fast";

export interface SavedSearchSettings {
    enableNeverFrequency: boolean;
}

export interface SyncSettings {
    enabled: boolean;
}

export interface TelemetrySettings {
    analyticsEnabled: boolean;
    diagnosticsEnabled: boolean;
}

export const DEFAULT_SETTINGS: Settings = {
    filters: {
        excludeKeywords: [],
        strataMaxDollars: STRATA_MAX,
        couldHaveOptions: DEFAULT_COULD_HAVES.map(option => ({ ...option })),
        couldHaveRuleIds: [],
        customPreferenceText: '',
        excludePropertyKeywords: [],
        enabled: {
            couldHaves: true,
            excludeKeywords: true,
            strataFees: true,
            propertyTypes: true,
        },
        excludeWhenNoCouldHaveMatch: false,
        enrichListingDetails: true,
    },
    flags: {
        enableExtension: true,
        enableBlacklist: true,
        enableAdBlocking: true,
        enableMapPins: true,
        enableCarouselControls: true,
    },
    queue: {
        enrichmentPace: "efficient",
    },
    cache: {
        ttlMs: 7 * 24 * 60 * 60 * 1000,
    },
    savedSearches: {
        enableNeverFrequency: true,
    },
    sync: {
        enabled: true,
    },
    telemetry: {
        analyticsEnabled: true,
        diagnosticsEnabled: true,
    },
}

const settingsRepository = createStorageRepository<Settings>({
    key: "settings",
    version: 4,
    createDefault: () => structuredClone(DEFAULT_SETTINGS),
    normalize: value => applyPatch(
        DEFAULT_SETTINGS,
        isPlainObject(value) ? value as DeepPartial<Settings> : {},
    ),
    // v3: detail enrichment became on-by-default (it only runs while a text filter is set);
    // the stored `false` from earlier versions was the old default, not a user choice.
    // v4: typed could-haves (one comma-separated string) became ticked options.
    migrate: (value, fromVersion) => {
        let settings = applyPatch(DEFAULT_SETTINGS, isPlainObject(value) ? value as DeepPartial<Settings> : {});
        if (fromVersion < 3) settings = applyPatch(settings, { filters: { enrichListingDetails: true } });
        return migrateCustomCouldHaves(settings);
    },
});

function migrateCustomCouldHaves(settings: Settings): Settings {
    const typed = parseCustomPreferences(settings.filters.customPreferenceText);
    if (typed.length === 0) return settings;
    const known = new Set(settings.filters.couldHaveOptions.map(option => option.id));
    return applyPatch(settings, {
        filters: {
            couldHaveOptions: [...settings.filters.couldHaveOptions, ...typed.filter(option => !known.has(option.id))],
            couldHaveRuleIds: [...new Set([...settings.filters.couldHaveRuleIds, ...typed.map(option => option.id)])],
            customPreferenceText: "",
        },
    });
}

export async function getSettings(): Promise<Settings> {
    return settingsRepository.get();
}

export async function setSettings(settings: Settings): Promise<void> {
    await settingsRepository.set(settings);
}

export async function updateSettings(patch: DeepPartial<Settings>, current?: Settings) {
    if (current) {
        await settingsRepository.set(applyPatch(current, patch));
        return;
    }

    await settingsRepository.update(settings => applyPatch(settings, patch));
}

export function toggleListId(ids: string[], id: string, checked: boolean): string[] {
    return checked
        ? [...new Set([...ids, id])]
        : ids.filter(existing => existing !== id);
}

export interface BlacklistEntry {
    url: string;
    addedAt: number;
    removedAt?: number;
    displayAddress?: string;
    thumbnailUrl?: string;
    listing?: ListingSnapshot;
}

/** Adds a could-have the user typed (ticked, unless `select` is false). Returns the option, or undefined for blank text. */
export async function addCouldHave(text: string, select = true): Promise<CouldHaveOption | undefined> {
    const option = createCouldHave(text);
    if (!option) return undefined;
    await settingsRepository.update(settings => {
        const exists = settings.filters.couldHaveOptions.some(existing => existing.id === option.id);
        return applyPatch(settings, {
            filters: {
                couldHaveOptions: exists ? settings.filters.couldHaveOptions : [...settings.filters.couldHaveOptions, option],
                couldHaveRuleIds: select
                    ? toggleListId(settings.filters.couldHaveRuleIds, option.id, true)
                    : settings.filters.couldHaveRuleIds,
            },
        });
    });
    return option;
}

export async function removeCouldHave(id: string): Promise<void> {
    await settingsRepository.update(settings => applyPatch(settings, {
        filters: {
            couldHaveOptions: settings.filters.couldHaveOptions.filter(option => option.id !== id),
            couldHaveRuleIds: settings.filters.couldHaveRuleIds.filter(existing => existing !== id),
        },
    }));
}

export async function setCouldHaveSelected(id: string, selected: boolean): Promise<void> {
    await settingsRepository.update(settings => applyPatch(settings, {
        filters: { couldHaveRuleIds: toggleListId(settings.filters.couldHaveRuleIds, id, selected) },
    }));
}

/** Back to the built-in list. Ticks on built-ins survive; the user's own could-haves go. */
export async function resetCouldHaves(): Promise<void> {
    await settingsRepository.update(settings => {
        const defaults = new Set(DEFAULT_COULD_HAVES.map(option => option.id));
        return applyPatch(settings, {
            filters: {
                couldHaveOptions: DEFAULT_COULD_HAVES.map(option => ({ ...option })),
                couldHaveRuleIds: settings.filters.couldHaveRuleIds.filter(id => defaults.has(id)),
            },
        });
    });
}

export function isDefaultCouldHaveList(options: readonly CouldHaveOption[]): boolean {
    return options.length === DEFAULT_COULD_HAVES.length &&
        options.every((option, index) =>
            option.id === DEFAULT_COULD_HAVES[index].id && option.label === DEFAULT_COULD_HAVES[index].label);
}
