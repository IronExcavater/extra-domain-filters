const AD_CARD_SELECTOR = '[data-testid^="adSpot-"]';

const AD_BANNER_SELECTOR = '[data-testid="adb-srp-top"]';

function hide(element: Element): void {
    if (element instanceof HTMLElement) {
        element.style.setProperty('display', 'none', 'important');
    }
}

function hideAds(): void {
    document.querySelectorAll(AD_CARD_SELECTOR).forEach(hide);

    document.querySelectorAll(AD_BANNER_SELECTOR).forEach(ad => {
        const banner = ad.parentElement?.parentElement;
        if (banner) hide(banner);
    });
}

export function bindAdRemoval(signal: AbortSignal): void {
    hideAds();

    const observer = new MutationObserver(hideAds);
    observer.observe(document.body, { childList: true, subtree: true });

    signal.addEventListener('abort', () => observer.disconnect());
}
