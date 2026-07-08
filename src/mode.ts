import { match } from "./shared/regex";

const isRentUrl = match([{ prefix: '/rent' }, { search: { mode: 'rent' } }]);

// The mode-buttons widget (Buy/Rent/Sold) reflects the user's actual current selection
// immediately; the URL can lag behind it (or not change at all, depending on how Domain's SPA
// routes mode switches). When present, it's the source of truth and overrides URL matching.
export function isRentMode(url: URL): boolean {
    const rentButton = document.querySelector('[data-testid="mode-button-rent"]');
    if (rentButton) return rentButton.getAttribute('data-selected') === 'true';

    return isRentUrl(url);
}

// The mode-buttons widget updates data-selected via React state, not a URL change or one of our
// bound trigger buttons — nothing would ever notice a Buy<->Rent toggle without watching this
// directly. Filtered to elements whose testid starts with "mode-button-" so unrelated
// data-selected toggles elsewhere on the page (e.g. the Property Size Metres²/Acres/Hectares
// switch, which uses the same attribute) don't trigger callbacks that have nothing to do with mode.
export function observeModeChanges(callback: () => void, signal: AbortSignal): void {
    const observer = new MutationObserver(mutations => {
        const changed = mutations.some(mutation =>
            mutation.attributeName === 'data-selected' &&
            (mutation.target as Element).getAttribute('data-testid')?.startsWith('mode-button-')
        );

        if (changed) callback();
    });

    observer.observe(document.body, {
        attributes: true,
        attributeFilter: ['data-selected'],
        subtree: true,
    });

    signal.addEventListener('abort', () => observer.disconnect(), { once: true });
}
