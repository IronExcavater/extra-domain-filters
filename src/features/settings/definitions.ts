import type { Settings } from "../../shared/state/settings";
import type { DeepPartial } from "../../shared/utils/types";

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

export const SETTINGS_SECTIONS: SettingsSection[] = [
    {
        id: "general",
        title: "Extension",
        description: "Choose where Extra Domain Filters is active.",
        settings: [{
            kind: "toggle",
            title: "Extra Domain Filters",
            description: "Enable extension features across Domain.",
            read: settings => settings.flags.enableExtension,
            write: (enableExtension: boolean) => ({ flags: { enableExtension } }),
        }],
    },
    {
        id: "browsing",
        title: "Browse listings",
        description: "Control listing actions and result-page enhancements.",
        settings: [
            {
                kind: "toggle",
                title: "Blacklist",
                description: "Show blacklist actions and hide blacklisted listings.",
                read: settings => settings.flags.enableBlacklist,
                write: (enableBlacklist: boolean) => ({ flags: { enableBlacklist } }),
            },
            {
                kind: "toggle",
                title: "Ad blocking",
                description: "Remove promoted placement cards from results.",
                read: settings => settings.flags.enableAdBlocking,
                write: (enableAdBlocking: boolean) => ({ flags: { enableAdBlocking } }),
            },
            {
                kind: "toggle",
                title: "Map matches",
                description: "Show preference matches on listing map pins.",
                read: settings => settings.flags.enableMapPins,
                write: (enableMapPins: boolean) => ({ flags: { enableMapPins } }),
            },
            {
                kind: "toggle",
                title: "Featured controls",
                description: "Add blacklist and pause controls to featured carousels.",
                read: settings => settings.flags.enableCarouselControls,
                write: (enableCarouselControls: boolean) => ({ flags: { enableCarouselControls } }),
            },
        ],
    },
    {
        id: "filters",
        title: "Matches and filters",
        description: "Control the signals used to match, hide, and enrich listings.",
        settings: [
            {
                kind: "toggle",
                title: "Could-haves filter",
                description: "Show optional property preference filters.",
                read: settings => settings.filters.enabled.couldHaves,
                write: (couldHaves: boolean) => ({ filters: { enabled: { couldHaves } } }),
            },
            {
                kind: "toggle",
                title: "Exclude keywords filter",
                description: "Show custom keyword exclusions.",
                read: settings => settings.filters.enabled.excludeKeywords,
                write: (excludeKeywords: boolean) => ({ filters: { enabled: { excludeKeywords } } }),
            },
            {
                kind: "toggle",
                title: "Strata fees filter",
                description: "Show the maximum quarterly strata fee filter.",
                read: settings => settings.filters.enabled.strataFees,
                write: (strataFees: boolean) => ({ filters: { enabled: { strataFees } } }),
            },
            {
                kind: "toggle",
                title: "Property type exclusions",
                description: "Use unselected property types as exclusions.",
                read: settings => settings.filters.enabled.propertyTypes,
                write: (propertyTypes: boolean) => ({ filters: { enabled: { propertyTypes } } }),
            },
            {
                kind: "toggle",
                title: "Hide non-matches",
                description: "Hide listings that do not match any selected could-have.",
                read: settings => settings.filters.excludeWhenNoCouldHaveMatch,
                write: (excludeWhenNoCouldHaveMatch: boolean) => ({ filters: { excludeWhenNoCouldHaveMatch } }),
            },
            {
                kind: "toggle",
                title: "Listing detail enrichment",
                description: "Optionally fetch viewed listing pages in the background to improve text-based matches. It is off until you turn it on.",
                read: settings => settings.filters.enrichListingDetails,
                write: (enrichListingDetails: boolean) => ({ filters: { enrichListingDetails } }),
            },
            {
                kind: "choice",
                title: "Background fetching pace",
                description: "Efficient is recommended: it keeps requests light. Choose a faster pace only when you want new results enriched sooner.",
                options: [
                    { value: "efficient", label: "Efficient (recommended)" },
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
        id: "saved-searches",
        title: "Saved searches",
        description: "Keep alert preferences under your control.",
        settings: [{
            kind: "toggle",
            title: "Local-only alerts",
            description: "Add the Never frequency for alerts managed by the extension instead of Domain email.",
            read: settings => settings.savedSearches.enableNeverFrequency,
            write: (enableNeverFrequency: boolean) => ({ savedSearches: { enableNeverFrequency } }),
        }],
    },
    {
        id: "account",
        title: "Account and sync",
        description: "Keep extension data available across your devices.",
        settings: [
            {
                kind: "toggle",
                title: "Cross-device sync",
                description: "Sync preferences, saved searches, and blacklist changes when signed in.",
                read: settings => settings.sync.enabled,
                write: (enabled: boolean) => ({ sync: { enabled } }),
            },
        ],
    },
    {
        id: "privacy",
        title: "Privacy and data",
        description: "Choose whether to share anonymous product health information.",
        settings: [
            {
                kind: "toggle",
                title: "Usage analytics",
                description: "Share anonymous feature categories. Search terms, property details, page URLs, and account identifiers are excluded.",
                read: settings => settings.telemetry.analyticsEnabled,
                write: (analyticsEnabled: boolean) => ({ telemetry: { analyticsEnabled } }),
            },
            {
                kind: "toggle",
                title: "Error diagnostics",
                description: "Share error categories and timing buckets, without page or property content.",
                read: settings => settings.telemetry.diagnosticsEnabled,
                write: (diagnosticsEnabled: boolean) => ({ telemetry: { diagnosticsEnabled } }),
            },
        ],
    },
];
