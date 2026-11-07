import { onBodyMutations } from "../../dom/bodyMutations";
import type { PageContext } from "../../platform/router";

const DESKTOP_SEARCH_SELECTOR = 'button[data-testid="search-button"]';
const TYPEAHEAD_INPUT_SELECTOR = "#fe-pa-domain-home-typeahead-input";
const HOME_MODE_ROUTES: Record<string, string> = {
    buy: "/sale/",
    houseandland: "/house-and-land/",
    newhomes: "/new-homes/",
    rent: "/rent/",
    retirement: "/retirement/",
    rural: "/rural/",
    sold: "/sold-listings/",
};

function bindModeButtons(context: PageContext): void {
    document.documentElement.dataset.edfHomeSearchMode ??= "buy";
    for (const mode of Object.keys(HOME_MODE_ROUTES)) {
        const button = document.querySelector<HTMLButtonElement>(`[data-testid="${mode}-navigation"]`);
        if (!button || button.dataset.edfHomeModeBound === "true") continue;
        button.dataset.edfHomeModeBound = "true";
        button.addEventListener("click", () => {
            document.documentElement.dataset.edfHomeSearchMode = mode;
        }, { signal: context.signal });
    }
}

function bindDesktopSearch(button: HTMLButtonElement, context: PageContext): void {
    if (button.dataset.edfHomeSearchBound === "true") return;

    button.dataset.edfHomeSearchBound = "true";
    button.addEventListener("click", event => {
        const input = document.querySelector<HTMLInputElement>(TYPEAHEAD_INPUT_SELECTOR);
        if (input?.value.trim()) return;

        event.preventDefault();
        event.stopImmediatePropagation();
        const mode = document.documentElement.dataset.edfHomeSearchMode ?? "buy";
        window.location.assign(HOME_MODE_ROUTES[mode] ?? HOME_MODE_ROUTES.buy);
    }, { capture: true, signal: context.signal });
}

export function bindHomeSearch(context: PageContext): void {
    const reconcile = (): void => {
        bindModeButtons(context);
        for (const button of document.querySelectorAll<HTMLButtonElement>(DESKTOP_SEARCH_SELECTOR)) {
            button.disabled = false;
            button.removeAttribute("aria-disabled");
            bindDesktopSearch(button, context);
        }
    };

    onBodyMutations(reconcile, context.signal);
    reconcile();
}
