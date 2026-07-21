import { PREFERENCES, STRATA_MAX } from "../../domain/matching";
import { createClaimTracker } from "../../shared/dom/claim";
import { bindLazyTrigger } from "../../shared/dom/trigger";
import { Logger } from "../../shared/platform/logging";
import { observeUrlChanges, PageContext } from "../../shared/platform/router";
import { onStorageChange } from "../../shared/platform/storage";
import { Property } from "../../shared/state/property";
import { getSettings, toggleListId, updateSettings, type Settings } from "../../shared/state/settings";
import { snapPrice } from "../../shared/utils/number";
import { createDraftProperty } from "./bindings/draft";
import { cloneCheckboxInput } from "./clone/checkbox";
import { cloneSliderInput } from "./clone/slider";
import { cloneTextInput } from "./clone/text";
import { isRentMode, observeModeChanges } from "./mode";
import { applySharedFilterParams, syncSharedFilterParams } from "./searchParams";

function refreshPriceTitles(url: URL): void {
    for (const priceDiv of document.querySelectorAll<HTMLDivElement>('[data-testid="dynamic-search-filters__price-range"]')) {
        const priceTitle = priceDiv.querySelector('h3');
        if (priceTitle) priceTitle.textContent = isRentMode(url) ? 'Price (Weekly)' : 'Price';
    }
}

const claim = createClaimTracker<Element>();

function appendCustomFilter(anchor: HTMLElement, filter: HTMLElement): void {
    const testId = filter.getAttribute("data-testid");
    if (testId) {
        anchor.parentElement
            ?.querySelector<HTMLElement>(`:scope > [data-testid="${testId}"]`)
            ?.remove();
    }

    anchor.after(filter);
}

export function bindFilterTriggers(selectors: string[], context: PageContext): void {
    const unwatchSettings = onStorageChange<Settings>("settings", settings => {
        if (settings) syncSharedFilterParams(settings);
    });
    context.signal.addEventListener("abort", unwatchSettings, { once: true });
    observeUrlChanges(url => {
        refreshPriceTitles(url);
        injectFilters(context.logger, url);
    }, context.signal);

    observeModeChanges(() => refreshPriceTitles(new URL(window.location.href)), context.signal);

    bindLazyTrigger(
        selectors,
        '[data-testid*="dynamic-search-filters"]',
        ctx => injectFilters(ctx.logger, ctx.url),
        context,
    );
}

export async function injectFilters(logger: Logger, url: URL) {
    logger.info('Injecting filters');
    await applySharedFilterParams(url);
    const settings = await getSettings();

    for (const mustHaveDiv of document.querySelectorAll<HTMLElement>('[data-testid="dynamic-search-filters__feature-options"]')) {
        if (!claim(mustHaveDiv)) continue;
        if (!settings.filters.enabled.couldHaves) continue;

        const mustHaveTitle = mustHaveDiv.children[0];

        const couldHaveDiv = mustHaveDiv.cloneNode(true) as HTMLElement;
        const couldHaveTitle = couldHaveDiv.children[0];

        couldHaveDiv.setAttribute('data-testid', 'dynamic-search-filters__preference-options');

        mustHaveTitle.textContent = 'Must-Haves';
        couldHaveTitle.textContent = 'Could-Haves';

        const checkboxDiv = couldHaveDiv.children[1] as HTMLDivElement;
        for (let i = couldHaveDiv.children.length - 1; i > 0; i--) {
            couldHaveDiv.removeChild(couldHaveDiv.children[i]);
        }

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
                },
            });
            const draftProperty = await createDraftProperty(mustHaveDiv, settingsProperty, false);

            couldHaveDiv.appendChild(await cloneCheckboxInput(
                checkboxDiv,
                draftProperty,
                {
                    id: preference.id,
                    label: preference.label,
                },
            ));
        }

        appendCustomFilter(mustHaveDiv, couldHaveDiv);

        logger.info('Appended preferences filter');
    }

    for (const includeDiv of document.querySelectorAll<HTMLDivElement>('[data-testid="dynamic-search-filters__keywords"]')) {
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
            },
        });
        const draftProperty = await createDraftProperty(includeDiv, settingsProperty, '');

        const excludeDiv = await cloneTextInput(
            includeDiv,
            draftProperty,
            {
                id: 'exclude',
                label: 'Exclude Keywords',
                placeholder: 'e.g. studio, granny flat',
                ariaLabel: 'Exclude keywords (example: studio, granny flat)',
            },
        );
        excludeDiv.setAttribute('data-testid', 'dynamic-search-filters__preferences');

        appendCustomFilter(includeDiv, excludeDiv);

        logger.info('Appended exclude keywords filter');
    }

    refreshPriceTitles(url);

    for (const priceDiv of document.querySelectorAll<HTMLDivElement>('[data-testid="dynamic-search-filters__price-range"]')) {
        if (!claim(priceDiv)) continue;
        if (!settings.filters.enabled.strataFees) continue;

        const settingsProperty = Property.from('number', {
            get: async () => {
                const settings = await getSettings();
                return settings.filters.strataMaxDollars;
            },
            set: async value => {
                await updateSettings({ filters: { strataMaxDollars: value }});
            },
        });
        const draftProperty = await createDraftProperty(priceDiv, settingsProperty, STRATA_MAX);

        const strataFeesDiv = await cloneSliderInput(
            priceDiv,
            draftProperty,
            {
                id: 'strataFees',
                label: 'Strata Fees (Quarterly)',
                max: STRATA_MAX,
                snap: snapPrice,
            },
        );
        strataFeesDiv.setAttribute('data-testid', 'dynamic-search-filters__strata-fees');

        appendCustomFilter(priceDiv, strataFeesDiv);

        logger.info('Appended strata fees filter');
    }

    requestAnimationFrame(() => refreshPriceTitles(url));

    for (const propertyTypesDiv of document.querySelectorAll<HTMLDivElement>('[data-testid="dynamic-search-filters__property-types"]')) {
        if (!claim(propertyTypesDiv)) continue;
        if (!settings.filters.enabled.propertyTypes) continue;

        const updatePropertyExclusions = async (): Promise<void> => {
            const checkboxes = [...propertyTypesDiv.querySelectorAll<HTMLInputElement>('input[type="checkbox"]')];
            const anyChecked = checkboxes.some(checkbox => checkbox.checked);

            const checkedParentNames = new Set(
                checkboxes
                    .filter(checkbox => checkbox.value === '' && checkbox.checked)
                    .map(checkbox => checkbox.name),
            );

            const excludePropertyKeywords = anyChecked
                ? checkboxes
                    .filter(checkbox => !checkbox.checked && !checkedParentNames.has(checkbox.name))
                    .map(checkbox =>
                        checkbox.closest('label')
                            ?.querySelector('div[class*="domain-checkbox__label"]')
                            ?.textContent?.split(':')[0]?.trim().toLowerCase()
                    )
                    .filter((label): label is string => Boolean(label))
                : [];

            await updateSettings({ filters: { excludePropertyKeywords } });
        };

        propertyTypesDiv.addEventListener('change', updatePropertyExclusions);
        await updatePropertyExclusions();

        logger.info('Bound property types exclusions');
    }
}
