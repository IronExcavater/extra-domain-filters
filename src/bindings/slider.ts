import { format } from "../shared/number";
import { Property, PropertyValue } from "../shared/property";

export type SliderKind = 'number' | 'range';

export function createSliderProperty<K extends SliderKind>(
    slider: HTMLDivElement,
    kind: K,
    config: {
        min?: number;
        max?: number;
        snap?: (value: number) => number;
        label?: HTMLElement;
    } = {},
): Property<K> {
    const parent = slider.parentElement;
    const background = slider.children[0] as HTMLElement
    const foreground = slider.children[2] as HTMLElement | undefined;
    const handles = slider.querySelectorAll<HTMLButtonElement>('button');

    if (!parent || !background || !foreground || handles.length !== 2) {
        throw new Error('Failed to locate slider input elements');
    }

    const minHandle = handles[0];
    const maxHandle = handles[1];

    const isRange = kind === 'range';
    const min = config.min ?? 0;
    const max = config.max ?? 100;
    const snap = config.snap ?? (value => value);

    let currentMin = min;
    let currentMax = max;

    const clamp = (value: number): number =>
        Math.min(Math.max(value, min), max);

    const percent = (value: number): number =>
        max === min ? 0 : ((value - min) / (max - min)) * 100;

    const getRange = (): PropertyValue<'range'> => ({
        min: currentMin,
        max: currentMax,
    });

    const getValue = (): PropertyValue<K> =>
        (isRange ? getRange() : currentMax) as PropertyValue<K>;

    const valueFromPointer = (event: PointerEvent): number => {
        const rect = slider.getBoundingClientRect();
        if (rect.width === 0) return min;

        const position = Math.min(
            Math.max((event.clientX - rect.left) / rect.width, 0),
            1,
        );

        return clamp(min + position * (max - min));
    };

    const render = (): void => {
        const minPercent = percent(currentMin);
        const maxPercent = percent(currentMax);

        if (isRange) {
            minHandle.style.left = `${minPercent}%`;
            minHandle.setAttribute('aria-valuenow', String(currentMin));
        }

        maxHandle.style.left = `${maxPercent}%`;
        maxHandle.setAttribute('aria-valuenow', String(currentMax));

        foreground.style.left = `${minPercent}%`;
        foreground.style.width = `${maxPercent - minPercent}%`;

        if (!config.label) return;

        const atMin = currentMin === min;
        const atMax = currentMax === max;

        if (atMin && atMax) config.label.textContent = 'Any';
        else if (!isRange) config.label.textContent = format(snap(currentMax));
        else if (atMin) config.label.textContent = `Under ${format(snap(currentMax))}`;
        else if (atMax) config.label.textContent = `Over ${format(snap(currentMin))}`;
        else config.label.textContent = `${format(snap(currentMin))} - ${format(snap(currentMax))}`;
    };

    const setMin = (value: number, shouldSnap: boolean): void => {
        const next = clamp(shouldSnap ? snap(value) : value);
        currentMin = Math.min(next, currentMax);
        render();
    };

    const setMax = (value: number, shouldSnap: boolean): void => {
        const next = clamp(shouldSnap ? snap(value) : value);
        currentMax = Math.max(next, currentMin);
        render();
    };

    const setRange = (value: PropertyValue<'range'>): void => {
        const nextMin = clamp(snap(value.min));
        const nextMax = clamp(snap(value.max));

        currentMin = Math.min(nextMin, nextMax);
        currentMax = Math.max(nextMin, nextMax);
        render();
    };

    for (const handle of handles) {
        handle.setAttribute('aria-valuemin', String(min));
        handle.setAttribute('aria-valuemax', String(max));
    }

    if (!isRange) {
        minHandle.remove();

        parent.style.setProperty('margin-left', '5px');
        background.style.setProperty('margin-left', '0');
    }

    render();

    return Property.from(kind, {
        get: getValue,

        set: value => {
            if (isRange) setRange(value as PropertyValue<'range'>);
            else setMax(value as number, true);
        },

        observe: notify => {
            let activeHandle: 'min' | 'max' | undefined;

            const setFromPointer = (
                event: PointerEvent,
                handle?: 'min' | 'max',
            ): void => {
                if (handle) activeHandle = handle;

                const value = valueFromPointer(event);

                if (activeHandle === 'min') setMin(value, false);
                else if (activeHandle === 'max') setMax(value, false);
            };

            const handleMinPointerDown = (event: PointerEvent): void => {
                setFromPointer(event, 'min');
                event.preventDefault();
            };

            const handleMaxPointerDown = (event: PointerEvent): void => {
                setFromPointer(event, 'max');
                event.preventDefault();
            };

            const handlePointerMove = (event: PointerEvent): void => {
                if (activeHandle) setFromPointer(event);
            };

            const handlePointerUp = (): void => {
                if (!activeHandle) return;

                if (activeHandle === 'min') setMin(currentMin, true);
                else setMax(currentMax, true);

                activeHandle = undefined;
                void notify(getValue());
            };

            if (isRange) {
                minHandle.addEventListener('pointerdown', handleMinPointerDown);
            }

            maxHandle.addEventListener('pointerdown', handleMaxPointerDown);
            document.addEventListener('pointermove', handlePointerMove);
            document.addEventListener('pointerup', handlePointerUp);

            return () => {
                minHandle.removeEventListener('pointerdown', handleMinPointerDown);
                maxHandle.removeEventListener('pointerdown', handleMaxPointerDown);
                document.removeEventListener('pointermove', handlePointerMove);
                document.removeEventListener('pointerup', handlePointerUp);
            };
        },
    });
}
