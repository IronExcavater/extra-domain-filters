import { createDraftProperty } from "../bindings/draft";
import { createClaimTracker } from "../core/claim";
import { Logger } from "../core/logging";
import { snapPrice } from "../core/number";
import { Property } from "../core/property";
import { observeUrlChanges, PageContext } from "../core/router";
import { getSettings, toggleListId, updateSettings } from "../core/settings";
import { bindLazyTrigger } from "../core/trigger";
import { PREFERENCES, STRATA_MAX } from "../matching";
import { cloneCheckboxInput } from "./clone/checkbox";
import { cloneSliderInput } from "./clone/slider";
import { cloneTextInput } from "./clone/text";
import { isRentMode, observeModeChanges } from "./mode";

function refreshPriceTitles(url: URL): void {
    for (const priceDiv of document.querySelectorAll<HTMLDivElement>('[data-testid="dynamic-search-filters__price-range"]')) {
        const priceTitle = priceDiv.querySelector('h3');
        if (priceTitle) priceTitle.textContent = isRentMode(url) ? 'Price (Weekly)' : 'Price';
    }
}

const claim = createClaimTracker<Element>();

// Each custom filter is cloned from its own anchor's full filter-wrapper (see clone/*.ts), so
// inserting it as a direct sibling right after that anchor drops it into Domain's own dialog
// layout naturally — same grid flow, same background, same position as the section it extends.
// A previous version collected every custom filter into one shared panel appended once at the
// dialog root; that put strata fees/could-haves/exclude-keywords all in one lump at the bottom
// of the dialog (in whichever position the panel happened to be created), in their own unstyled
// column, instead of next to price/must-haves/include-keywords where they belong.
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

    for (const mustHaveDiv of document.querySelectorAll<HTMLElement>('[data-testid="dynamic-search-filters__feature-options"]')) {
        if (!claim(mustHaveDiv)) continue;

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

    // The mode-buttons widget (read by isRentMode) is a separate component from the filter
    // dialog, so on first open it can still be mid-render when the block above already ran —
    // recheck once more after React has had a frame to settle both.
    requestAnimationFrame(() => refreshPriceTitles(url));

    for (const propertyTypesDiv of document.querySelectorAll<HTMLDivElement>('[data-testid="dynamic-search-filters__property-types"]')) {
        if (!claim(propertyTypesDiv)) continue;

        // Generalizes domain.js's handleTypeInput/isStudioType (which only ever tracked "studio")
        // into the full set of excluded property labels: an empty selection means any type is
        // wanted (nothing excluded); otherwise every unchecked checkbox is excluded, UNLESS its
        // own parent category (house/apartment/town-house/land) is checked — checking a parent
        // means "any sub-type of this is fine", so its children never count as excluded.
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
                    // A checkbox's label often carries a result-count span (e.g. "House:(25726)")
                    // right after the name — cut it off at the colon instead of the name.
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
