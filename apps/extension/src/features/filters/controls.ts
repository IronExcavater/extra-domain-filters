import type { Property } from "../../state/property";
import { createSvgIcon, createUiButton, type IconRenderer } from "../../ui/elements";
import { replaceWithCloseIcon } from "../../ui/icons";
import { createCheckboxProperty } from "./bindings/checkbox";
import { createSliderProperty } from "./bindings/slider";
import { createTextProperty } from "./bindings/text";

interface ControlConfig {
    icon?: IconRenderer;
    id: string;
    label: string;
}

function createSection(label: string, testId: string, icon?: IconRenderer): HTMLDivElement {
    const section = document.createElement("div");
    const heading = document.createElement("h3");

    section.className = "edf-filter-section";
    section.classList.toggle("edf-filter-section-home", window.location.pathname === "/");
    section.dataset.testid = testId;
    heading.className = "edf-filter-heading";
    if (icon && window.location.pathname !== "/") {
        heading.append(createSvgIcon(icon, "edf-filter-heading-icon"));
    }
    heading.append(label);
    section.append(heading);
    return section;
}

function createSearchBar(input: HTMLInputElement, label: string): HTMLDivElement {
    const bar = document.createElement("div");
    const clear = createUiButton({
        ariaLabel: `Clear ${label.toLowerCase()}`,
        icon: replaceWithCloseIcon,
        variant: "icon",
    });

    bar.className = "edf-filter-search-bar";
    clear.classList.add("edf-filter-search-bar-clear");
    const syncClearVisibility = (): void => {
        clear.hidden = input.value.length === 0;
    };
    clear.addEventListener("click", () => {
        input.value = "";
        input.dispatchEvent(new Event("input", { bubbles: true }));
        input.dispatchEvent(new Event("change", { bubbles: true }));
        input.focus();
    });
    input.addEventListener("input", syncClearVisibility);
    syncClearVisibility();
    bar.append(input, clear);
    return bar;
}

export async function createCheckboxControl(
    property: Property<"boolean">,
    config: ControlConfig,
): Promise<HTMLLabelElement> {
    const label = document.createElement("label");
    const box = document.createElement("span");
    const input = document.createElement("input");
    const indicator = document.createElement("span");
    const shade = document.createElement("span");
    const check = document.createElement("span");
    const text = document.createElement("span");

    // Mirrors Domain's `.domain-checkbox`: a 24px bordered box, a green shade that fades in,
    // and a check drawn from two CSS bars, so it renders identically to the native control.
    label.className = "edf-filter-checkbox";
    box.className = "edf-filter-checkbox-box";
    input.id = `edf-filter-${config.id}`;
    input.name = config.id;
    input.type = "checkbox";
    indicator.className = "edf-filter-checkbox-indicator";
    shade.className = "edf-filter-checkbox-shade";
    check.className = "edf-filter-checkbox-check";
    text.className = "edf-filter-checkbox-label";
    text.textContent = config.label;
    shade.append(check);
    indicator.append(shade);
    box.append(input, indicator);
    label.append(box, text);
    await property.bindTwoWay(createCheckboxProperty(input));
    return label;
}

type TextConfig = ControlConfig & { ariaLabel?: string; placeholder?: string };

async function createTextField(property: Property<"string">, config: TextConfig): Promise<HTMLDivElement> {
    const input = document.createElement("input");

    input.className = "edf-filter-text";
    input.id = `edf-filter-${config.id}`;
    input.name = config.id;
    input.placeholder = config.placeholder ?? "";
    input.ariaLabel = config.ariaLabel ?? config.label;
    input.type = "text";
    await property.bindTwoWay(createTextProperty(input));
    return createSearchBar(input, config.label);
}

export async function createTextControl(
    property: Property<"string">,
    config: TextConfig & { testId: string },
): Promise<HTMLDivElement> {
    const section = createSection(config.label, config.testId, config.icon);
    section.append(await createTextField(property, config));
    return section;
}

/** A labelled text field inside another filter section (e.g. typed could-haves). */
export async function createSubTextControl(
    property: Property<"string">,
    config: TextConfig,
): Promise<HTMLDivElement> {
    const field = document.createElement("div");
    const label = document.createElement("label");

    field.className = "edf-filter-subfield";
    label.className = "edf-filter-subfield-label";
    label.htmlFor = `edf-filter-${config.id}`;
    label.textContent = config.label;
    field.append(label, await createTextField(property, config));
    return field;
}

export async function createRangeControl(
    property: Property<"number">,
    config: ControlConfig & { max: number; min?: number; snap?: (value: number) => number; testId: string },
): Promise<HTMLDivElement> {
    const section = createSection(config.label, config.testId, config.icon);
    const header = section.querySelector("h3");
    const output = document.createElement("output");
    const input = document.createElement("input");

    output.className = "edf-filter-range-value";
    output.htmlFor = `edf-filter-${config.id}`;
    input.className = "edf-filter-range";
    input.id = `edf-filter-${config.id}`;
    input.max = String(config.max);
    input.min = String(config.min ?? 0);
    input.name = config.id;
    input.type = "range";
    if (header) header.after(output);
    const field = document.createElement("div");
    field.className = "edf-filter-range-field";
    field.append(input);
    section.append(field);
    await property.bindTwoWay(createSliderProperty(input, {
        label: output,
        max: config.max,
        min: config.min,
        snap: config.snap,
    }));
    return section;
}

export function createFilterSection(label: string, testId: string, icon?: IconRenderer): HTMLDivElement {
    return createSection(label, testId, icon);
}

export function createFilterAction(options: {
    ariaLabel: string;
    icon: IconRenderer;
    label?: string;
    signal?: AbortSignal;
    tooltip?: string;
}): HTMLButtonElement {
    return createUiButton({
        ...options,
        variant: options.label ? "secondary" : "icon",
    });
}
