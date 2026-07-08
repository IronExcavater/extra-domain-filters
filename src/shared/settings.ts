import { STRATA_MAX } from "../matching";
import { getFromStorage, setInStorage } from "./storage";
import { applyPatch, DeepPartial } from "./types";

export interface Settings {
    flags: FlagSettings;
    filters: FilterSettings;
    queue: QueueSettings;
    cache: CacheSettings;
}

export interface FlagSettings {
    enableExtension: boolean;
    enableBlacklist: boolean;
}

export interface FilterSettings {
    excludeKeywords: string[];
    strataMaxDollars: number;
    couldHaveRuleIds: string[];
    customPreferenceText: string;
    excludePropertyKeywords: string[];
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
    },
    flags: {
        enableExtension: true,
        enableBlacklist: true,
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

export async function getSettings(): Promise<Settings> {
    return await getFromStorage<Settings>('settings') ?? DEFAULT_SETTINGS;
}

export async function updateSettings(patch: DeepPartial<Settings>, current?: Settings) {
    const updated = applyPatch(current ?? await getSettings(), patch);
    await setInStorage<Settings>('settings', updated);
}

export function toggleListId(ids: string[], id: string, checked: boolean): string[] {
    return checked
        ? [...new Set([...ids, id])]
        : ids.filter(existing => existing !== id);
}

export interface BlacklistEntry {
    url: string;
    addedAt: number;
    displayAddress?: string;
    thumbnailUrl?: string;
}

export interface FilterPreset {
    id: string;
    name: string;
    createdAt: number;
    filters: FilterSettings;
}