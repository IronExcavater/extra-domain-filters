const AD_CARD_SELECTOR = '[data-testid^="adSpot-"]';

const AD_BANNER_SELECTOR = '[data-testid="adb-srp-top"]';

// Hide, never remove: these nodes belong to React's own tree, and actually detaching them
// desyncs React's fiber from the live DOM. It has no way to know we did it, so the next time it
// touches that subtree (e.g. reconciling a page-change) it uses stale node references as
// insertBefore/removeChild anchors and throws NotFoundError, taking the whole results page down.
// An inline !important display:none leaves the node in place for React but invisible to the user.
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
