import { PageContext } from "../../shared/router";

// Ad slots are numbered siblings interspersed among listing <li>s in the results list
// (adSpot-1, adSpot-2, ...) — remove whichever are currently present.
const AD_SELECTOR = '[data-testid^="adSpot-"]';

function removeAds(): void {
    document.querySelectorAll(AD_SELECTOR).forEach(ad => ad.remove());
}

// TODO: dispatch each listing <li> to a type-specific handler, in its own file per type:
// - standard: a single property, data-testid="listing-{id}"
// - topspot: a carousel of several featured properties in one <li data-testid="topspot">
// - project: a new-development card covering many properties/apartments at once (DOM not seen yet)

export function bindListingCards(context: PageContext): void {
    removeAds();

    const observer = new MutationObserver(removeAds);
    observer.observe(document.body, { childList: true, subtree: true });

    context.signal.addEventListener('abort', () => observer.disconnect());
}
