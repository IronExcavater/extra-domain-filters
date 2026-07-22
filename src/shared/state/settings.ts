import { STRATA_MAX, type ListingSnapshot } from "../../domain/matching";
import { createStorageRepository } from "../platform/repository";
import { applyPatch, type DeepPartial } from "../utils/types";

export interface Settings {
    flags: FlagSettings;
    filters: FilterSettings;
    queue: QueueSettings;
    cache: CacheSettings;
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
    couldHaveRuleIds: string[];
    customPreferenceText: string;
    excludePropertyKeywords: string[];
    enabled: FilterFeatureSettings;
    excludeWhenNoCouldHaveMatch: boolean;
}

export interface FilterFeatureSettings {
    couldHaves: boolean;
    excludeKeywords: boolean;
    strataFees: boolean;
    propertyTypes: boolean;
}

export interface QueueSettings {
    concurrency: number;
    minSpacingMs: number;
    timeoutMs: number;
    maxRetries: number;
}

export interface CacheSettings {
    ttlMs: number;
}

export const DEFAULT_SETTINGS: Settings = {
    filters: {
        excludeKeywords: [],
        strataMaxDollars: STRATA_MAX,
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
    },
    flags: {
        enableExtension: true,
        enableBlacklist: true,
        enableAdBlocking: true,
        enableMapPins: true,
        enableCarouselControls: true,
    },
    queue: {
        concurrency: 3,
        minSpacingMs: 300,
        timeoutMs: 8000,
        maxRetries: 2,
    },
    cache: {
        ttlMs: 7 * 24 * 60 * 60 * 1000,
    }
}

const settingsRepository = createStorageRepository<Settings>({
    key: "settings",
    version: 1,
    createDefault: () => structuredClone(DEFAULT_SETTINGS),
    normalize: value => applyPatch(
        DEFAULT_SETTINGS,
        typeof value === "object" && value !== null ? value as DeepPartial<Settings> : {},
    ),
});

export async function getSettings(): Promise<Settings> {
    return settingsRepository.get();
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

export interface FilterPreset {
    id: string;
    name: string;
    createdAt: number;
    filters: FilterSettings;
}
