import type { Settings } from "../../shared/state/settings";
import type { DeepPartial } from "../../shared/utils/types";

export interface SettingDefinition {
    title: string;
    description: string;
    read(settings: Settings): boolean;
    write(value: boolean): DeepPartial<Settings>;
}

export interface SettingsSection {
    id: string;
    title: string;
    settings: SettingDefinition[];
}

export const SETTINGS_SECTIONS: SettingsSection[] = [
    {
        id: "general",
        title: "General",
        settings: [{
            title: "Extra Domain Filters",
            description: "Enable extension features across Domain.",
            read: settings => settings.flags.enableExtension,
            write: enableExtension => ({ flags: { enableExtension } }),
        }],
    },
    {
        id: "browsing",
        title: "Browsing",
        settings: [
            {
                title: "Blacklist",
                description: "Show blacklist actions and hide blacklisted listings.",
                read: settings => settings.flags.enableBlacklist,
                write: enableBlacklist => ({ flags: { enableBlacklist } }),
            },
            {
                title: "Ad blocking",
                description: "Remove promoted placement cards from results.",
                read: settings => settings.flags.enableAdBlocking,
                write: enableAdBlocking => ({ flags: { enableAdBlocking } }),
            },
            {
                title: "Map matches",
                description: "Show preference matches on listing map pins.",
                read: settings => settings.flags.enableMapPins,
                write: enableMapPins => ({ flags: { enableMapPins } }),
            },
            {
                title: "Featured controls",
                description: "Add blacklist and pause controls to featured carousels.",
                read: settings => settings.flags.enableCarouselControls,
                write: enableCarouselControls => ({ flags: { enableCarouselControls } }),
            },
        ],
    },
    {
        id: "filters",
        title: "Search filters",
        settings: [
            {
                title: "Could-haves filter",
                description: "Show optional property preference filters.",
                read: settings => settings.filters.enabled.couldHaves,
                write: couldHaves => ({ filters: { enabled: { couldHaves } } }),
            },
            {
                title: "Exclude keywords filter",
                description: "Show custom keyword exclusions.",
                read: settings => settings.filters.enabled.excludeKeywords,
                write: excludeKeywords => ({ filters: { enabled: { excludeKeywords } } }),
            },
            {
                title: "Strata fees filter",
                description: "Show the maximum quarterly strata fee filter.",
                read: settings => settings.filters.enabled.strataFees,
                write: strataFees => ({ filters: { enabled: { strataFees } } }),
            },
            {
                title: "Property type exclusions",
                description: "Use unselected property types as exclusions.",
                read: settings => settings.filters.enabled.propertyTypes,
                write: propertyTypes => ({ filters: { enabled: { propertyTypes } } }),
            },
            {
                title: "Hide non-matches",
                description: "Hide listings that do not match any selected could-have.",
                read: settings => settings.filters.excludeWhenNoCouldHaveMatch,
                write: excludeWhenNoCouldHaveMatch => ({ filters: { excludeWhenNoCouldHaveMatch } }),
            },
        ],
    },
    {
        id: "saved-searches",
        title: "Saved searches",
        settings: [{
            title: "Local-only alerts",
            description: "Add the Never frequency for alerts managed by the extension instead of Domain email.",
            read: settings => settings.savedSearches.enableNeverFrequency,
            write: enableNeverFrequency => ({ savedSearches: { enableNeverFrequency } }),
        }],
    },
    {
        id: "account",
        title: "Account",
        settings: [
            {
                title: "Cross-device sync",
                description: "Sync preferences, saved searches, and blacklist changes when signed in.",
                read: settings => settings.sync.enabled,
                write: enabled => ({ sync: { enabled } }),
            },
        ],
    },
    {
        id: "privacy",
        title: "Privacy",
        settings: [
            {
                title: "Usage analytics",
                description: "Share anonymous feature categories. Search terms, property details, page URLs, and account identifiers are excluded.",
                read: settings => settings.telemetry.analyticsEnabled,
                write: analyticsEnabled => ({ telemetry: { analyticsEnabled } }),
            },
            {
                title: "Error diagnostics",
                description: "Share error categories and timing buckets, without page or property content.",
                read: settings => settings.telemetry.diagnosticsEnabled,
                write: diagnosticsEnabled => ({ telemetry: { diagnosticsEnabled } }),
            },
        ],
    },
];
