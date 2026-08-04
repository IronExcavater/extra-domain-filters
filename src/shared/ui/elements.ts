export type IconRenderer = (target: SVGElement) => void;

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

export function createIconButton(
    label: string,
    renderIcon: IconRenderer,
    className = "edf-icon-button",
): HTMLButtonElement {
    const button = createButton("", className);

    button.ariaLabel = label;
    button.append(createSvgIcon(renderIcon));
    attachTooltip(button, label);

    return button;
}
import { attachTooltip } from "./tooltip";
