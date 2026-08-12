export type IconRenderer = (target: SVGElement) => void;
export type ButtonVariant = "danger" | "icon" | "primary" | "quiet" | "secondary";

export interface UiButtonOptions {
    ariaLabel?: string;
    busy?: boolean;
    className?: string;
    icon?: IconRenderer;
    label?: string;
    signal?: AbortSignal;
    tooltip?: string;
    variant: ButtonVariant;
}

export function createSvgIcon(
    render: IconRenderer,
    className = "domain-icon",
): SVGSVGElement {
    const svg = document.createElementNS("http://www.w3.org/2000/svg", "svg");

    svg.classList.add(className);
    svg.setAttribute("aria-hidden", "true");
    render(svg);

    return svg;
}

export function createButton(
    label: string,
    className: string,
): HTMLButtonElement {
    const button = document.createElement("button");

    button.className = className;
    button.type = "button";
    button.textContent = label;

    return button;
}

export function createUiButton(options: UiButtonOptions): HTMLButtonElement {
    const button = document.createElement("button");

    button.className = `edf-ui-button edf-ui-button-${options.variant}`;
    if (options.className) button.classList.add(...options.className.split(/\s+/).filter(Boolean));
    button.type = "button";
    button.disabled = options.busy ?? false;
    if (options.busy) button.setAttribute("aria-busy", "true");
    if (options.ariaLabel) button.ariaLabel = options.ariaLabel;

    if (options.icon) button.append(createSvgIcon(options.icon, "edf-ui-button-icon-svg"));
    if (options.label) {
        const label = document.createElement("span");
        label.className = "edf-ui-button-label";
        label.textContent = options.label;
        button.append(label);
    }

    if (options.tooltip) attachTooltip(button, options.tooltip, { signal: options.signal });

    return button;
}

import { attachTooltip } from "./tooltip";
