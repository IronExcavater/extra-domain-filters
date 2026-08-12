import { DEFAULT_SETTINGS, type Settings } from "../../state/settings";
import { isPlainObject } from "../../utils/types";
import { mergeClockedFields, type ClockedFields, type LogicalClock } from "./merge";

const knownFields = new Set(Object.keys(flatten(DEFAULT_SETTINGS)));

function flatten(value: unknown, prefix = "", result: Record<string, unknown> = {}): Record<string, unknown> {
    if (isPlainObject(value)) {
        for (const [key, child] of Object.entries(value)) {
            flatten(child, prefix ? `${prefix}.${key}` : key, result);
        }
    } else if (prefix) {
        result[prefix] = structuredClone(value);
    }

    return result;
}

function setPath(target: Record<string, unknown>, path: string, value: unknown): void {
    const keys = path.split(".");
    let parent = target;

    for (const key of keys.slice(0, -1)) {
        const child = parent[key];
        if (!isPlainObject(child)) return;
        parent = child;
    }

    parent[keys.at(-1)!] = structuredClone(value);
}

export function clockSettings(
    settings: Settings,
    clock: LogicalClock,
): ClockedFields {
    return Object.fromEntries(
        Object.entries(flatten(settings)).map(([field, value]) => [
            field,
            { clock, value },
        ]),
    );
}

export function recordSettingsChanges(
    fields: ClockedFields,
    previous: Settings,
    next: Settings,
    clock: LogicalClock,
): ClockedFields {
    const previousValues = flatten(previous);
    const nextValues = flatten(next);
    const updates: ClockedFields = {};

    for (const [field, value] of Object.entries(nextValues)) {
        if (JSON.stringify(previousValues[field]) === JSON.stringify(value)) continue;
        updates[field] = { clock, value };
    }

    return mergeClockedFields(fields, updates);
}

export function materializeSettings(
    fields: ClockedFields,
    fallback: Settings,
): Settings {
    const settings = structuredClone(fallback) as unknown as Record<string, unknown>;

    for (const [field, entry] of Object.entries(fields)) {
        if (knownFields.has(field)) setPath(settings, field, entry.value);
    }

    return settings as unknown as Settings;
}
