import { createSvgIcon } from "./elements";
import { replaceWithChevronIcon } from "./icons";

export type SortOption = readonly [value: string, label: string];

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
