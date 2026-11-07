import { createClaimTracker } from "../../dom/claim";
import { markOwned, OWNED_ELEMENT_ATTRIBUTE } from "../../dom/ownership";
import { bindLazyTrigger } from "../../dom/trigger";
import { PREFERENCES, STRATA_MAX } from "../../domain/matching";
import { trackTelemetry } from "../../domain/telemetry/client";
import type { LifecycleScope } from "../../platform/lifecycle";
import { PageContext } from "../../platform/router";
import { onStorageChange } from "../../platform/storage";
import { findDomainFilterHosts, readExcludedPropertyTypes } from "../../site-dom/filters";
import { Property } from "../../state/property";
import { getSettings, toggleListId, updateSettings, type Settings } from "../../state/settings";
import {
    replaceWithPopupSavedSearchIcon,
    replaceWithPopupStarIcon,
    replaceWithPriceFilterIcon,
} from "../../ui/icons";
import { snapPrice } from "../../utils/number";
import { createDraftProperty } from "./bindings/draft";
import {
    createCheckboxControl,
    createFilterSection,
    createRangeControl,
    createTextControl,
} from "./controls";
import { syncSharedFilterParams } from "./searchParams";

function reportAsyncError(context: PageContext, action: string): (error: unknown) => void {
    return error => context.logger.warn(action, error);
}

const propertyTypeClaim = createClaimTracker<Element>();
const filterScopes = new WeakMap<Element, LifecycleScope>();

function removeCustomFilters(): void {
    for (const filter of document.querySelectorAll<HTMLElement>(
        `[${OWNED_ELEMENT_ATTRIBUTE}="search-filter"]`,
    )) {
        filterScopes.get(filter)?.dispose();
        filter.remove();
    }
}

function isFilterInteraction(target: Element): boolean {
    if (target.closest(`[${OWNED_ELEMENT_ATTRIBUTE}="search-filter"]`)) return true;

    const dialog = target.closest('[role="dialog"]');
    return Boolean(dialog?.querySelector('[data-testid*="dynamic-search-filters"]')) ||
        Boolean(target.closest('[data-testid*="dynamic-search-filters"]'));
}

function appendCustomFilter(
    anchor: HTMLElement,
    filter: HTMLElement,
    scope: LifecycleScope,
): boolean {
    const dialog = anchor.closest<HTMLElement>('[role="dialog"]');
    if (!anchor.isConnected || anchor.getClientRects().length === 0 || dialog?.getAttribute("aria-hidden") === "true") {
        return false;
    }

    const testId = filter.getAttribute("data-testid");
    const existingFilter = testId
        ? anchor.parentElement?.querySelector(
            `:scope > [${OWNED_ELEMENT_ATTRIBUTE}="search-filter"][data-testid="${testId}"]`,
        )
        : undefined;

    if (existingFilter) return false;

    markOwned(filter, "search-filter");
    filterScopes.set(filter, scope);
    scope.add(() => filter.remove());
    anchor.after(filter);
    return true;
}

export function bindFilterTriggers(selectors: string[], context: PageContext): void {
    const unwatchSettings = onStorageChange<Settings>("settings", settings => {
        if (settings) syncSharedFilterParams(settings);
    });
    context.scope.add(unwatchSettings);
    document.addEventListener('click', event => {
        const target = event.target;
        if (!(target instanceof Element)) return;

        const isFilterTrigger = selectors.some(selector => target.closest(selector));
        if (isFilterTrigger || !isFilterInteraction(target)) removeCustomFilters();
    }, { signal: context.signal, capture: true });

    bindLazyTrigger(
        selectors,
        '[data-testid*="dynamic-search-filters"]',
        ctx => injectFilters(ctx).catch(reportAsyncError(ctx, "Failed to inject filters after filter menu opened")),
        context,
    );
}

export async function injectFilters(context: PageContext) {
    const logger = context.logger;
    logger.info('Injecting filters');
    const settings = await getSettings();
    if (context.signal.aborted) return;

    const hosts = findDomainFilterHosts();
    for (const mustHaveDiv of hosts.featureSections) {
        if (!settings.filters.enabled.couldHaves) continue;

        const scope = context.scope.child("could-haves-filter");
        const couldHaveDiv = createFilterSection(
            "Could-Haves",
            "dynamic-search-filters__preference-options",
            replaceWithPopupStarIcon,
        );
        const checkboxGrid = document.createElement("div");
        checkboxGrid.className = "edf-filter-checkbox-grid";
        couldHaveDiv.append(checkboxGrid);

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
                scope,
            );

            checkboxGrid.appendChild(await createCheckboxControl(
                draftProperty,
                {
                    id: preference.id,
                    label: preference.label,
                },
            ));
        }

        if (context.signal.aborted || !appendCustomFilter(mustHaveDiv, couldHaveDiv, scope)) {
            scope.dispose();
            continue;
        }

        logger.info('Appended preferences filter');
    }

    for (const includeDiv of hosts.keywordSections) {
        if (!settings.filters.enabled.excludeKeywords) continue;

        const includeInput = includeDiv.querySelector<HTMLInputElement>('input');

        if (!includeInput) throw new Error('Failed to locate include keywords input');

        const scope = context.scope.child("exclude-keywords-filter");

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
            scope,
        );

        const excludeDiv = await createTextControl(
            draftProperty,
            {
                id: 'exclude',
                label: 'Exclude Keywords',
                placeholder: 'e.g. studio, granny flat',
                ariaLabel: 'Exclude keywords (example: studio, granny flat)',
                icon: replaceWithPopupSavedSearchIcon,
                testId: 'dynamic-search-filters__preferences',
            },
        );

        if (context.signal.aborted || !appendCustomFilter(includeDiv, excludeDiv, scope)) {
            scope.dispose();
            continue;
        }

        logger.info('Appended exclude keywords filter');
    }

    for (const priceDiv of hosts.priceSections) {
        if (!settings.filters.enabled.strataFees) continue;

        const scope = context.scope.child("strata-fees-filter");

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
            scope,
        );

        const strataFeesDiv = await createRangeControl(
            draftProperty,
            {
                id: 'strataFees',
                label: 'Strata Fees (Quarterly)',
                icon: replaceWithPriceFilterIcon,
                max: STRATA_MAX,
                snap: snapPrice,
                testId: 'dynamic-search-filters__strata-fees',
            },
        );

        if (context.signal.aborted || !appendCustomFilter(priceDiv, strataFeesDiv, scope)) {
            scope.dispose();
            continue;
        }

        logger.info('Appended strata fees filter');
    }

    for (const propertyTypesDiv of hosts.propertyTypeSections) {
        if (!propertyTypeClaim(propertyTypesDiv)) continue;
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
