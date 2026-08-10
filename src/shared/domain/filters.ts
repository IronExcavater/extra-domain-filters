export interface DomainFilterHosts {
    featureSections: HTMLElement[];
    keywordSections: HTMLDivElement[];
    priceSections: HTMLDivElement[];
    propertyTypeSections: HTMLDivElement[];
}

export interface DomainFilterActionPlacement {
    host: HTMLElement;
    insertAfter: Element;
}

const FILTER_ACTION_ANCHOR_SELECTOR = [
    "button#allfilters",
    "button#mode",
    "button#price",
    "button#bedrooms",
    "button#propertyTypes",
].join(",");

export function findDomainFilterHosts(root: ParentNode = document): DomainFilterHosts {
    return {
        featureSections: [...root.querySelectorAll<HTMLElement>(
            '[data-testid="dynamic-search-filters__feature-options"]',
        )],
        keywordSections: [...root.querySelectorAll<HTMLDivElement>(
            '[data-testid="dynamic-search-filters__keywords"]',
        )],
        priceSections: [...root.querySelectorAll<HTMLDivElement>(
            '[data-testid="dynamic-search-filters__price-range"]',
        )],
        propertyTypeSections: [...root.querySelectorAll<HTMLDivElement>(
            '[data-testid="dynamic-search-filters__property-types"]',
        )],
    };
}

export function findDomainPropertyAlertButton(root: ParentNode = document): HTMLButtonElement | undefined {
    return root.querySelector<HTMLButtonElement>('button[name="property-alert"]') ??
        [...root.querySelectorAll<HTMLButtonElement>("button")]
            .find(button => /^(?:create|edit) alert$/i.test(button.textContent?.trim() ?? ""));
}

export function findDomainFilterActionPlacement(root: ParentNode = document): DomainFilterActionPlacement | undefined {
    const alertButton = findDomainPropertyAlertButton(root);
    if (alertButton?.parentElement) return { host: alertButton.parentElement, insertAfter: alertButton };

    const anchor = root.querySelector<HTMLButtonElement>(FILTER_ACTION_ANCHOR_SELECTOR);
    return anchor?.parentElement ? { host: anchor.parentElement, insertAfter: anchor } : undefined;
}

export function readExcludedPropertyTypes(section: HTMLElement): string[] {
    const checkboxes = [...section.querySelectorAll<HTMLInputElement>('input[type="checkbox"]')];
    if (!checkboxes.some(checkbox => checkbox.checked)) return [];

    const checkedParentNames = new Set(
        checkboxes
            .filter(checkbox => checkbox.value === "" && checkbox.checked)
            .map(checkbox => checkbox.name),
    );

    return checkboxes
        .filter(checkbox => !checkbox.checked && !checkedParentNames.has(checkbox.name))
        .map(checkbox => checkbox.closest("label")?.textContent?.split(":")[0]?.trim().toLowerCase())
        .filter((label): label is string => Boolean(label));
}
