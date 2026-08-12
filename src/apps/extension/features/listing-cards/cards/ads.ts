import { onBodyMutations } from "../../../dom/bodyMutations";

const AD_CARD_SELECTOR = '[data-testid^="adSpot-"]';
const AD_BANNER_SELECTOR = '[data-testid="adb-srp-top"]';
const TOP_AD_WRAPPER_ATTRIBUTE = "data-edf-srp-top-ad";

function hideElement(element: HTMLElement): void {
    element.hidden = true;
    element.setAttribute("aria-hidden", "true");
    element.style.setProperty("display", "none", "important");
}

function getTopAdWrapper(ad: Element): HTMLElement | undefined {
    const iframeContainer = ad.parentElement;
    const slotContainer = iframeContainer?.parentElement;
    const outerContainer = slotContainer?.parentElement;

    if (outerContainer instanceof HTMLElement && outerContainer.childElementCount === 1) {
        return outerContainer;
    }

    if (slotContainer instanceof HTMLElement) return slotContainer;
    return ad instanceof HTMLElement ? ad : undefined;
}

function hideAds(): void {
    document.querySelectorAll<HTMLElement>(AD_CARD_SELECTOR).forEach(ad => {
        hideElement(ad);
    });

    document.querySelectorAll(AD_BANNER_SELECTOR).forEach(ad => {
        const wrapper = getTopAdWrapper(ad);
        if (!wrapper) return;
        wrapper.setAttribute(TOP_AD_WRAPPER_ATTRIBUTE, "true");
        hideElement(wrapper);
        if (ad instanceof HTMLElement) hideElement(ad);
    });
}

export function bindAdRemoval(signal: AbortSignal): void {
    hideAds();
    onBodyMutations(hideAds, signal);
}
