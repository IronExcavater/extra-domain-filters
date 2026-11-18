import { createSvgIcon } from "./elements";
import { replaceWithChevronIcon } from "./icons";

export type SortOption = readonly [value: string, label: string];

/** The menu's corner radius (sort.css .edf-sort-dropdown-menu). */
const MENU_RADIUS = 8;

export interface SortControl {
    element: HTMLElement;
    value(): string;
}

export interface DropdownControlOptions {
    ariaLabel: string;
    onChange(value: string): void;
    options: readonly SortOption[];
    signal?: AbortSignal;
    value?: string;
}

export interface SortControlOptions {
    ariaLabel: string;
    label?: string;
    onChange(): void;
    options: readonly SortOption[];
    signal?: AbortSignal;
    value?: string;
}

/** The part of the window the element's scrolling ancestors leave visible. */
function getVisibleBand(element: Element): { bottom: number; top: number } {
    let top = 0;
    let bottom = window.innerHeight;
    for (let node = element.parentElement; node; node = node.parentElement) {
        if (getComputedStyle(node).overflowY === "visible") continue;
        const rect = node.getBoundingClientRect();
        top = Math.max(top, rect.top);
        bottom = Math.min(bottom, rect.bottom);
    }
    return { bottom, top };
}

function createChevron(): SVGSVGElement {
    const icon = createSvgIcon(replaceWithChevronIcon);

    icon.classList.add("edf-sort-chevron");

    return icon;
}

export function createDropdownControl(options: DropdownControlOptions): SortControl {
    const details = document.createElement("details");
    const summary = document.createElement("summary");
    const menu = document.createElement("div");
    let selected = options.value ?? options.options[0]?.[0] ?? "";

    details.className = "edf-sort-dropdown";
    summary.className = "edf-sort-dropdown-button";
    summary.ariaLabel = options.ariaLabel;
    menu.className = "edf-sort-dropdown-menu";

    /**
     * Opens the menu and places it in the same task, before the browser paints: below the
     * button, or above when it won't fit below but has more room there. (Placing it from the
     * toggle event, which fires after a frame, showed it below first and then flipped it.)
     */
    const open = (): void => {
        details.open = true;
        const button = summary.getBoundingClientRect();
        const band = getVisibleBand(details);
        const below = band.bottom - button.bottom;
        const menuBox = menu.getBoundingClientRect();
        details.dataset.placement = below < menuBox.height + 8 && button.top - band.top > below
            ? "top"
            : "bottom";
        // A menu wider than its button rounds the corner that sticks out past it.
        menu.dataset.edfRoundTopLeft = String(menuBox.width - button.width > MENU_RADIUS + 0.5);
    };

    const renderSummary = (): void => {
        const text = options.options.find(([value]) => value === selected)?.[1] ?? options.ariaLabel;
        summary.replaceChildren(text, createChevron());
    };

    for (const [value, text] of options.options) {
        const option = document.createElement("button");
        option.className = "edf-sort-dropdown-option";
        option.type = "button";
        option.dataset.selected = String(value === selected);
        option.textContent = text;
        option.addEventListener("click", () => {
            selected = value;
            renderSummary();
            for (const sibling of menu.querySelectorAll<HTMLButtonElement>("button")) {
                sibling.dataset.selected = String(sibling === option);
            }
            details.open = false;
            options.onChange(selected);
        }, { signal: options.signal });
        menu.append(option);
    }

    details.addEventListener("keydown", event => {
        if (event.key !== "Escape") return;
        details.open = false;
        summary.focus();
    }, { signal: options.signal });
    // Clicks (and Enter/Space, which click) open it here rather than through <details>' own
    // toggle, so it can be placed before it's drawn.
    summary.addEventListener("click", event => {
        event.preventDefault();
        if (details.open) details.open = false;
        else open();
    }, { signal: options.signal });
    document.addEventListener("pointerdown", event => {
        if (!details.open || details.contains(event.target as Node)) return;
        details.open = false;
    }, { signal: options.signal });

    renderSummary();
    details.append(summary, menu);
    return {
        element: details,
        value: () => selected,
    };
}

export function createSortControl(options: SortControlOptions): SortControl {
    const root = document.createElement("div");
    const label = document.createElement("span");
    const dropdown = createDropdownControl({
        ariaLabel: options.ariaLabel,
        onChange: () => options.onChange(),
        options: options.options,
        signal: options.signal,
        value: options.value,
    });

    root.className = "edf-sort-control";
    label.className = "edf-sort-control-label";
    label.textContent = options.label ?? "Sort by";
    root.append(label, dropdown.element);
    return {
        element: root,
        value: dropdown.value,
    };
}
