// Ad slots are numbered siblings interspersed among listing <li>s in the results list
// (adSpot-1, adSpot-2, ...).
const AD_SELECTOR = '[data-testid^="adSpot-"]';

// A CSS rule applies to any matching element the instant it exists, regardless of when or how it
// got inserted — unlike DOM removal via MutationObserver, there's no timing/race to get wrong and
// no flash of ad content while waiting for a mutation callback to fire.
function hideAdsImmediately(): void {
    if (document.getElementById('extra-domain-filters-hide-ads')) return;

    const style = document.createElement('style');
    style.id = 'extra-domain-filters-hide-ads';
    style.textContent = `${AD_SELECTOR} { display: none !important; }`;
    document.head.append(style);
}

function removeAds(): void {
    document.querySelectorAll(AD_SELECTOR).forEach(ad => ad.remove());
}

export function bindAdRemoval(signal: AbortSignal): void {
    hideAdsImmediately();
    removeAds();

    const observer = new MutationObserver(removeAds);
    observer.observe(document.body, { childList: true, subtree: true });

    signal.addEventListener('abort', () => observer.disconnect());
}
