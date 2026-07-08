import { createSliderProperty, SliderKind } from "../../bindings/slider";
import { Property } from "../../shared/property";

export async function cloneSliderInput<K extends SliderKind>(
    source: HTMLDivElement,
    property: Property<K>,
    config: {
        id: string,
        label?: string,
        min?: number,
        max?: number,
        snap?: (value: number) => number,
    },
): Promise<HTMLDivElement> {
    const div = source.cloneNode(true) as HTMLDivElement;

    const title = div.querySelector('h3');
    const label = div.querySelector<HTMLElement>('[data-testid$="-range-label"]');
    const container = div.querySelector<HTMLElement>('[data-testid$="-range-container"]');

    if (!title || !label || !container) throw new Error('Failed to locate slider input elements');

    title.textContent = config.label ?? '';

    const slider = container.querySelector<HTMLDivElement>('[class*="rheostat"]');

    if (!slider) throw new Error('Failed to locate slider input elements');

    await property.bindTwoWay(createSliderProperty(
        slider,
        property.kind,
        {
            min: config.min,
            max: config.max,
            snap: config.snap,
            label,
        },
    ));

    div.querySelector('.pill-clear-button')?.remove();
    return div;
}
