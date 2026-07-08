import { createCheckboxProperty } from "../../bindings/checkbox";
import { Property } from "../../core/property";

export async function cloneCheckboxInput(
    source: HTMLDivElement,
    property: Property<'boolean'>,
    config: {
        id: string,
        label: string,
    },
): Promise<HTMLDivElement> {
    const div = source.cloneNode(true) as HTMLDivElement;
    const label = div.querySelector('div[class*="domain-checkbox__label"]');
    const input = div.querySelector<HTMLInputElement>('input');

    if (!label || !input) throw new Error('Failed to locate checkbox input elements');

    label.textContent = config.label;
    input.name = config.id;
    await property.bindTwoWay(createCheckboxProperty(input));

    div.querySelector('.pill-clear-button')?.remove();
    return div;
}
