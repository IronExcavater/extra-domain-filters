const AD_CARD_SELECTOR = '[data-testid^="adSpot-"]';

const AD_BANNER_SELECTOR = '[data-testid="adb-srp-top"]';

function hideAds(): void {
    document.querySelectorAll(AD_CARD_SELECTOR).forEach(ad => ad.remove());

    document.querySelectorAll(AD_BANNER_SELECTOR).forEach(ad => {
        const banner = ad.parentElement?.parentElement;
        banner?.remove();
    });
}

export function bindAdRemoval(signal: AbortSignal): void {
    hideAds();

    const observer = new MutationObserver(hideAds);
    observer.observe(document.body, { childList: true, subtree: true });

    signal.addEventListener('abort', () => observer.disconnect());
}
