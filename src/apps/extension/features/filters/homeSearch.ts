import { onBodyMutations } from "../../dom/bodyMutations";
import type { PageContext } from "../../platform/router";

const DESKTOP_SEARCH_SELECTOR = 'button[data-testid="search-button"]';
const TYPEAHEAD_SEARCH_SELECTOR = "#typeahead__search-button";
const TYPEAHEAD_INPUT_SELECTOR = "#fe-pa-domain-home-typeahead-input";

function bindDesktopSearch(button: HTMLButtonElement, context: PageContext): void {
    if (button.dataset.edfHomeSearchBound === "true") return;

    button.dataset.edfHomeSearchBound = "true";
    button.addEventListener("click", event => {
        const input = document.querySelector<HTMLInputElement>(TYPEAHEAD_INPUT_SELECTOR);
        if (input?.value.trim()) return;

        const search = document.querySelector<HTMLButtonElement>(TYPEAHEAD_SEARCH_SELECTOR);
        if (!search || search.disabled) return;

        event.preventDefault();
        event.stopImmediatePropagation();
        search.click();
    }, { capture: true, signal: context.signal });
}

export function bindHomeSearch(context: PageContext): void {
    const reconcile = (): void => {
        for (const button of document.querySelectorAll<HTMLButtonElement>(DESKTOP_SEARCH_SELECTOR)) {
            button.disabled = false;
            button.removeAttribute("aria-disabled");
            bindDesktopSearch(button, context);
        }
    };

    onBodyMutations(reconcile, context.signal);
    reconcile();
}
