import type { Property } from "../../shared/state/property";
import { createUiButton, type IconRenderer } from "../../shared/ui/elements";
import { createCheckboxProperty } from "./bindings/checkbox";
import { createSliderProperty } from "./bindings/slider";
import { createTextProperty } from "./bindings/text";

interface ControlConfig {
    id: string;
    label: string;
}

function createSection(label: string, testId: string): HTMLDivElement {
    const section = document.createElement("div");
    const heading = document.createElement("h3");

    section.className = "edf-filter-section";
    section.dataset.testid = testId;
    heading.className = "edf-filter-heading";
    heading.textContent = label;
    section.append(heading);
    return section;
}

function createClearButton(
    input: HTMLInputElement,
    value: string,
    label: string,
): HTMLButtonElement {
    const button = createUiButton({
        ariaLabel: label,
        label: "Clear",
        variant: "quiet",
    });
    button.classList.add("edf-filter-clear");
    button.addEventListener("click", () => {
        input.value = value;
        input.dispatchEvent(new Event("input", { bubbles: true }));
        input.dispatchEvent(new Event("change", { bubbles: true }));
    });
    return button;
}

export async function createCheckboxControl(
    property: Property<"boolean">,
    config: ControlConfig,
): Promise<HTMLLabelElement> {
    const label = document.createElement("label");
    const input = document.createElement("input");
    const indicator = document.createElement("span");
    const text = document.createElement("span");

    label.className = "edf-filter-checkbox";
    input.id = `edf-filter-${config.id}`;
    input.name = config.id;
    input.type = "checkbox";
    indicator.className = "edf-filter-checkbox-indicator";
    indicator.textContent = "✓";
    text.textContent = config.label;
    label.append(input, indicator, text);
    await property.bindTwoWay(createCheckboxProperty(input));
    return label;
}

export async function createTextControl(
    property: Property<"string">,
    config: ControlConfig & { ariaLabel?: string; placeholder?: string; testId: string },
): Promise<HTMLDivElement> {
    const section = createSection(config.label, config.testId);
    const input = document.createElement("input");
    const field = document.createElement("div");

    input.className = "edf-filter-text";
    input.id = `edf-filter-${config.id}`;
    input.name = config.id;
    input.placeholder = config.placeholder ?? "";
    input.ariaLabel = config.ariaLabel ?? config.label;
    input.type = "text";
    field.className = "edf-filter-field";
    field.append(input, createClearButton(input, "", `Clear ${config.label.toLowerCase()}`));
    section.append(field);
    await property.bindTwoWay(createTextProperty(input));
    return section;
}

export async function createRangeControl(
    property: Property<"number">,
    config: ControlConfig & { max: number; min?: number; snap?: (value: number) => number; testId: string },
): Promise<HTMLDivElement> {
    const section = createSection(config.label, config.testId);
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
    field.append(input, createClearButton(input, String(config.max), `Clear ${config.label.toLowerCase()}`));
    section.append(field);
    await property.bindTwoWay(createSliderProperty(input, {
        label: output,
        max: config.max,
        min: config.min,
        snap: config.snap,
    }));
    return section;
}

export function createFilterSection(label: string, testId: string): HTMLDivElement {
    return createSection(label, testId);
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
