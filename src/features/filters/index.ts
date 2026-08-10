import { PREFERENCES, STRATA_MAX } from "../../domain/matching";
import { trackTelemetry } from "../../domain/telemetry/client";
import { createClaimTracker } from "../../shared/dom/claim";
import { markOwned, OWNED_ELEMENT_ATTRIBUTE } from "../../shared/dom/ownership";
import { bindLazyTrigger } from "../../shared/dom/trigger";
import { findDomainFilterHosts, readExcludedPropertyTypes } from "../../shared/domain/filters";
import { observeUrlChanges, PageContext } from "../../shared/platform/router";
import { onStorageChange } from "../../shared/platform/storage";
import { Property } from "../../shared/state/property";
import { getSettings, toggleListId, updateSettings, type Settings } from "../../shared/state/settings";
import { snapPrice } from "../../shared/utils/number";
import { createDraftProperty } from "./bindings/draft";
import {
    createCheckboxControl,
    createFilterSection,
    createRangeControl,
    createTextControl,
} from "./controls";
import { isRentMode, observeModeChanges } from "./mode";
import { syncSharedFilterParams } from "./searchParams";

function reportAsyncError(context: PageContext, action: string): (error: unknown) => void {
    return error => context.logger.warn(action, error);
}

function refreshPriceTitles(url: URL): void {
    for (const priceDiv of findDomainFilterHosts().priceSections) {
        const priceTitle = priceDiv.querySelector('h3');
        if (priceTitle) priceTitle.textContent = isRentMode(url) ? 'Price (Weekly)' : 'Price';
    }
}

const claim = createClaimTracker<Element>();

function appendCustomFilter(anchor: HTMLElement, filter: HTMLElement): void {
    const testId = filter.getAttribute("data-testid");
    const existingFilter = testId
        ? anchor.parentElement?.querySelector(
            `:scope > [${OWNED_ELEMENT_ATTRIBUTE}="search-filter"][data-testid="${testId}"]`,
        )
        : undefined;

    if (existingFilter) return;

    anchor.after(markOwned(filter, "search-filter"));
}

export function bindFilterTriggers(selectors: string[], context: PageContext): void {
    const unwatchSettings = onStorageChange<Settings>("settings", settings => {
        if (settings) syncSharedFilterParams(settings);
    });
    context.scope.add(unwatchSettings);
    observeUrlChanges(url => {
        refreshPriceTitles(url);
    }, context.signal);

    observeModeChanges(() => refreshPriceTitles(new URL(window.location.href)), context.signal);

    bindLazyTrigger(
        selectors,
        '[data-testid*="dynamic-search-filters"]',
        ctx => injectFilters(ctx).catch(reportAsyncError(ctx, "Failed to inject filters after filter menu opened")),
        context,
    );
}

export async function injectFilters(context: PageContext, url = context.url) {
    const logger = context.logger;
    logger.info('Injecting filters');
    const settings = await getSettings();
    if (context.signal.aborted) return;

    const hosts = findDomainFilterHosts();
    for (const mustHaveDiv of hosts.featureSections) {
        if (!claim(mustHaveDiv)) continue;
        if (!settings.filters.enabled.couldHaves) continue;

        const mustHaveTitle = mustHaveDiv.querySelector("h2, h3");
        const couldHaveDiv = createFilterSection(
            "Could-Haves",
            "dynamic-search-filters__preference-options",
        );
        const checkboxGrid = document.createElement("div");
        checkboxGrid.className = "edf-filter-checkbox-grid";
        couldHaveDiv.append(checkboxGrid);
        if (mustHaveTitle) mustHaveTitle.textContent = "Must-Haves";

        for (const preference of PREFERENCES) {
            const settingsProperty = Property.from('boolean', {
                get: async () => {
                    const settings = await getSettings();
                    return settings.filters.couldHaveRuleIds.includes(preference.id);
                },
                set: async value => {
                    const settings = await getSettings();
                    await updateSettings({ filters: { couldHaveRuleIds:
                        toggleListId(settings.filters.couldHaveRuleIds, preference.id, value)
                    }}, settings);
                    void trackTelemetry({ name: "feature_used", feature: "could_haves" });
                },
            });
            const draftProperty = await createDraftProperty(
                mustHaveDiv,
                settingsProperty,
                false,
                context.scope,
            );

            checkboxGrid.appendChild(await createCheckboxControl(
                draftProperty,
                {
                    id: preference.id,
                    label: preference.label,
                },
            ));
        }

        if (context.signal.aborted) return;
        appendCustomFilter(mustHaveDiv, couldHaveDiv);

        logger.info('Appended preferences filter');
    }

    for (const includeDiv of hosts.keywordSections) {
        if (!claim(includeDiv)) continue;
        if (!settings.filters.enabled.excludeKeywords) continue;

        const includeTitle = includeDiv.querySelector('h3');
        const includeInput = includeDiv.querySelector<HTMLInputElement>('input');

        if (!includeTitle || !includeInput) throw new Error('Failed to locate include keywords input');

        includeTitle.textContent = 'Include Keywords';
        includeInput.ariaLabel = 'Include keywords (example: waterfront, views, street name)';

        const settingsProperty = Property.from('string', {
            get: async () => {
                const settings = await getSettings();
                return settings.filters.excludeKeywords.join(', ');
            },
            set: async value => {
                const excludeKeywords = value.split(',').map(k => k.trim()).filter(Boolean);
                await updateSettings({ filters: { excludeKeywords }});
                void trackTelemetry({ name: "feature_used", feature: "exclude_keywords" });
            },
        });
        const draftProperty = await createDraftProperty(
            includeDiv,
            settingsProperty,
            '',
            context.scope,
        );

        const excludeDiv = await createTextControl(
            draftProperty,
            {
                id: 'exclude',
                label: 'Exclude Keywords',
                placeholder: 'e.g. studio, granny flat',
                ariaLabel: 'Exclude keywords (example: studio, granny flat)',
                testId: 'dynamic-search-filters__preferences',
            },
        );

        if (context.signal.aborted) return;
        appendCustomFilter(includeDiv, excludeDiv);

        logger.info('Appended exclude keywords filter');
    }

    refreshPriceTitles(url);

    for (const priceDiv of hosts.priceSections) {
        if (!claim(priceDiv)) continue;
        if (!settings.filters.enabled.strataFees) continue;

        const settingsProperty = Property.from('number', {
            get: async () => {
                const settings = await getSettings();
                return settings.filters.strataMaxDollars;
            },
            set: async value => {
                await updateSettings({ filters: { strataMaxDollars: value }});
                void trackTelemetry({ name: "feature_used", feature: "strata_fees" });
            },
        });
        const draftProperty = await createDraftProperty(
            priceDiv,
            settingsProperty,
            STRATA_MAX,
            context.scope,
        );

        const strataFeesDiv = await createRangeControl(
            draftProperty,
            {
                id: 'strataFees',
                label: 'Strata Fees (Quarterly)',
                max: STRATA_MAX,
                snap: snapPrice,
                testId: 'dynamic-search-filters__strata-fees',
            },
        );

        if (context.signal.aborted) return;
        appendCustomFilter(priceDiv, strataFeesDiv);

        logger.info('Appended strata fees filter');
    }

    requestAnimationFrame(() => {
        if (!context.signal.aborted) refreshPriceTitles(url);
    });

    for (const propertyTypesDiv of hosts.propertyTypeSections) {
        if (!claim(propertyTypesDiv)) continue;
        if (!settings.filters.enabled.propertyTypes) continue;

        const updatePropertyExclusions = async (track = false): Promise<void> => {
            const excludePropertyKeywords = readExcludedPropertyTypes(propertyTypesDiv);

            await updateSettings({ filters: { excludePropertyKeywords } });
            if (track) void trackTelemetry({ name: "feature_used", feature: "property_type_exclusions" });
        };

        propertyTypesDiv.addEventListener('change', () => {
            void updatePropertyExclusions(true);
        }, {
            signal: context.signal,
        });
        if (context.signal.aborted) return;
        await updatePropertyExclusions();

        logger.info('Bound property types exclusions');
    }
}
