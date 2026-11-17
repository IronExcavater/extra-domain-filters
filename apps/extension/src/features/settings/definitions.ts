import type { Settings } from "../../state/settings";
import type { DeepPartial } from "../../utils/types";

export interface SettingDefinition {
    description: string;
    kind: "toggle";
    read(settings: Settings): boolean;
    title: string;
    write(value: boolean): DeepPartial<Settings>;
}

export interface ChoiceSettingDefinition {
    title: string;
    description: string;
    kind: "choice";
    options: readonly ChoiceOption[];
    read(settings: Settings): string;
    write(value: string): DeepPartial<Settings>;
}

export interface ChoiceOption {
    label: string;
    value: string;
}

export type SettingsControlDefinition = ChoiceSettingDefinition | SettingDefinition;

export interface SettingsSection {
    description?: string;
    id: string;
    settings: SettingsControlDefinition[];
    title: string;
}

/**
 * Settings, grouped compactly: General (the master switch and every on-page feature), the
 * filter-panel options (shown on the Filters page), cross-device sync (inside the Account
 * card) and privacy (whose card also holds the maintenance actions).
 */
export const SETTINGS_SECTIONS: SettingsSection[] = [
    {
        id: "general",
        title: "General",
        settings: [
            {
                kind: "toggle",
                title: "Extra Domain Filters",
                description: "Turn every extension feature on Domain on or off.",
                read: settings => settings.flags.enableExtension,
                write: (enableExtension: boolean) => ({ flags: { enableExtension } }),
            },
            {
                kind: "toggle",
                title: "Blacklist",
                description: "Blacklist buttons on listings, and hide what you blacklist.",
                read: settings => settings.flags.enableBlacklist,
                write: (enableBlacklist: boolean) => ({ flags: { enableBlacklist } }),
            },
            {
                kind: "toggle",
                title: "Map pins",
                description: "Hide filtered listings' pins and colour could-have matches gold.",
                read: settings => settings.flags.enableMapPins,
                write: (enableMapPins: boolean) => ({ flags: { enableMapPins } }),
            },
            {
                kind: "toggle",
                title: "Ad blocking",
                description: "Remove promoted cards from results.",
                read: settings => settings.flags.enableAdBlocking,
                write: (enableAdBlocking: boolean) => ({ flags: { enableAdBlocking } }),
            },
            {
                kind: "toggle",
                title: "Featured controls",
                description: "Blacklist and pause buttons on featured carousels.",
                read: settings => settings.flags.enableCarouselControls,
                write: (enableCarouselControls: boolean) => ({ flags: { enableCarouselControls } }),
            },
            {
                kind: "toggle",
                title: "Local-only alerts",
                description: "Add a Never frequency to saved search alerts, for searches you check yourself.",
                read: settings => settings.savedSearches.enableNeverFrequency,
                write: (enableNeverFrequency: boolean) => ({ savedSearches: { enableNeverFrequency } }),
            },
        ],
    },
    {
        id: "filters",
        title: "On Domain",
        settings: [
            {
                kind: "toggle",
                title: "Could-haves",
                description: "Show your could-haves in Domain's filter panel.",
                read: settings => settings.filters.enabled.couldHaves,
                write: (couldHaves: boolean) => ({ filters: { enabled: { couldHaves } } }),
            },
            {
                kind: "toggle",
                title: "Exclude keywords",
                description: "Show the exclude keywords field in Domain's filter panel.",
                read: settings => settings.filters.enabled.excludeKeywords,
                write: (excludeKeywords: boolean) => ({ filters: { enabled: { excludeKeywords } } }),
            },
            {
                kind: "toggle",
                title: "Strata fees",
                description: "Show the maximum strata fee slider in Domain's filter panel.",
                read: settings => settings.filters.enabled.strataFees,
                write: (strataFees: boolean) => ({ filters: { enabled: { strataFees } } }),
            },
            {
                kind: "toggle",
                title: "Property type exclusions",
                description: "Hide listings of the types you untick, including ones described as that type.",
                read: settings => settings.filters.enabled.propertyTypes,
                write: (propertyTypes: boolean) => ({ filters: { enabled: { propertyTypes } } }),
            },
            {
                kind: "toggle",
                title: "Read listing details",
                description: "Read each listing's description in the background, so could-haves, keywords and strata can match.",
                read: settings => settings.filters.enrichListingDetails,
                write: (enrichListingDetails: boolean) => ({ filters: { enrichListingDetails } }),
            },
            {
                kind: "choice",
                title: "Reading pace",
                description: "How quickly listing details are read in the background.",
                options: [
                    { value: "efficient", label: "Efficient" },
                    { value: "balanced", label: "Balanced" },
                    { value: "fast", label: "Fast" },
                ],
                read: settings => settings.queue.enrichmentPace,
                write: (enrichmentPace: string) => ({
                    queue: {
                        enrichmentPace: enrichmentPace === "balanced" || enrichmentPace === "fast"
                            ? enrichmentPace
                            : "efficient",
                    },
                }),
            },
        ],
    },
    {
        id: "sync",
        title: "Sync",
        settings: [
            {
                kind: "toggle",
                title: "Cross-device sync",
                description: "Sync preferences, saved searches and your blacklist while signed in.",
                read: settings => settings.sync.enabled,
                write: (enabled: boolean) => ({ sync: { enabled } }),
            },
        ],
    },
    {
        id: "privacy",
        title: "Privacy and data",
        settings: [
            {
                kind: "toggle",
                title: "Usage analytics",
                description: "Share anonymous feature use. Never search terms, properties, URLs or account details.",
                read: settings => settings.telemetry.analyticsEnabled,
                write: (analyticsEnabled: boolean) => ({ telemetry: { analyticsEnabled } }),
            },
            {
                kind: "toggle",
                title: "Error diagnostics",
                description: "Share error types and timings, without page or property content.",
                read: settings => settings.telemetry.diagnosticsEnabled,
                write: (diagnosticsEnabled: boolean) => ({ telemetry: { diagnosticsEnabled } }),
            },
        ],
    },
];
