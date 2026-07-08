import { createTextProperty } from "../../../bindings/text";
import { Property } from "../../../shared/property";

export async function cloneTextInput(
    source: HTMLDivElement,
    property: Property<'string'>,
    config: {
        id: string,
        label?: string,
        placeholder?: string,
        ariaLabel?: string,
    },
): Promise<HTMLDivElement> {
    const div = source.cloneNode(true) as HTMLDivElement;
    const title = div.querySelector('h3');
    const input = div.querySelector<HTMLInputElement>('input');

    if (!title || !input) throw new Error('Failed to locate text input elements');

    title.textContent = config.label ?? '';
    input.name = config.id;
    input.placeholder = config.placeholder ?? '';
    input.ariaLabel = config.ariaLabel ?? '';
    input.value = '';
    await property.bindTwoWay(createTextProperty(input));

    div.querySelector('.pill-clear-button')?.remove();
    return div;
}
