const AD_CARD_SELECTOR = '[data-testid^="adSpot-"]';

const AD_BANNER_SELECTOR = '[data-testid="adb-srp-top"]';

function removeAds(): void {
    document.querySelectorAll(AD_CARD_SELECTOR).forEach(ad => ad.remove());

    document
        .querySelectorAll(AD_BANNER_SELECTOR)
        .forEach(ad => ad.parentElement?.parentElement?.remove());
}

export function bindAdRemoval(signal: AbortSignal): void {
    removeAds();

    const observer = new MutationObserver(removeAds);
    observer.observe(document.body, { childList: true, subtree: true });

    signal.addEventListener('abort', () => observer.disconnect());
}
