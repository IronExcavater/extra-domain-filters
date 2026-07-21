import { getFromStorage, setInStorage } from "../platform/storage";
import type { FilterSettings } from "./settings";

const PRESETS_KEY = "filter-presets";

export interface FilterPreset {
    id: string;
    name: string;
    createdAt: number;
    filters: FilterSettings;
    pinned: boolean;
}

function createId(): string {
    const random = crypto.getRandomValues(new Uint32Array(1))[0].toString(36);
    return `preset-${Date.now().toString(36)}-${random}`;
}

export async function getFilterPresets(): Promise<FilterPreset[]> {
    return (await getFromStorage<FilterPreset[]>(PRESETS_KEY)) ?? [];
}

export async function saveFilterPreset(
    name: string,
    filters: FilterSettings,
): Promise<FilterPreset> {
    const preset: FilterPreset = {
        createdAt: Date.now(),
        filters,
        id: createId(),
        name: name.trim() || "Saved filters",
        pinned: true,
    };

    await setInStorage(PRESETS_KEY, [...await getFilterPresets(), preset]);
    return preset;
}

export async function setFilterPresetPinned(id: string, pinned: boolean): Promise<void> {
    await setInStorage(PRESETS_KEY, (await getFilterPresets()).map(preset =>
        preset.id === id ? { ...preset, pinned } : preset,
    ));
}

export async function removeFilterPreset(id: string): Promise<void> {
    await setInStorage(PRESETS_KEY, (await getFilterPresets()).filter(preset => preset.id !== id));
}
