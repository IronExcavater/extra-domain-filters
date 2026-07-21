export interface CloneActionButtonOptions {
    label?: string;
    icon?: (icon: SVGSVGElement) => void;
}

export function cloneActionButton(
    source: HTMLButtonElement,
    options: CloneActionButtonOptions = {},
): HTMLButtonElement {
    const button = source.cloneNode(true) as HTMLButtonElement;
    const icon = button.querySelector<SVGSVGElement>("svg");
    const label = [...button.querySelectorAll<HTMLElement>("span")]
        .find(span => !span.querySelector("svg"));

    button.type = "button";
    if (options.label === undefined) label?.remove();
    else if (label) label.textContent = options.label;

    if (icon && options.icon) options.icon(icon);
    else icon?.closest("span")?.remove();

    return button;
}
