import { match } from "../../utils/regex";

const isRentUrl = match([{ prefix: '/rent' }, { search: { mode: 'rent' } }]);

export function isRentMode(url: URL): boolean {
    const rentButton = document.querySelector('[data-testid="mode-button-rent"]');
    if (rentButton) return rentButton.getAttribute('data-selected') === 'true';

    return isRentUrl(url);
}

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
