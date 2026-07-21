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
        title: "Filters",
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
        id: "matching",
        title: "Display",
        settings: [
            {
                title: "Match tags",
                description: "Show selected preference matches on listing cards.",
                read: settings => settings.display.showPreferenceTags,
                write: showPreferenceTags => ({ display: { showPreferenceTags } }),
            },
            {
                title: "Hide blacklisted listings",
                description: "Collapse blacklisted cards from search results while keeping their actions available.",
                read: settings => settings.display.hideBlacklistedListings,
                write: hideBlacklistedListings => ({ display: { hideBlacklistedListings } }),
            },
            {
                title: "Animate listing updates",
                description: "Animate cards into their new positions after filters or blacklists change.",
                read: settings => settings.display.animateListingUpdates,
                write: animateListingUpdates => ({ display: { animateListingUpdates } }),
            },
        ],
    },
];
