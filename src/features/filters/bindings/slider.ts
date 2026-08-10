import { Property } from "../../../shared/state/property";
import { format } from "../../../shared/utils/number";

export function createSliderProperty(
    input: HTMLInputElement,
    config: {
        label?: HTMLElement;
        max: number;
        min?: number;
        snap?: (value: number) => number;
    },
): Property<"number"> {
    const min = config.min ?? 0;
    const snap = config.snap ?? (value => value);

    const render = (value: number): void => {
        input.value = String(value);
        input.style.setProperty("--edf-range-progress", `${((value - min) / (config.max - min)) * 100}%`);
        if (config.label) config.label.textContent = value === config.max ? "Any" : format(value);
    };

    input.step = "any";
    render(config.max);

    return Property.from("number", {
        get: () => Number(input.value),
        set: value => render(snap(value)),
        observe: notify => {
            const preview = (): void => render(Number(input.value));
            const commit = (): void => {
                const value = snap(Number(input.value));
                render(value);
                void notify(value);
            };
            input.addEventListener("input", preview);
            input.addEventListener("change", commit);
            return () => {
                input.removeEventListener("input", preview);
                input.removeEventListener("change", commit);
            };
        },
    });
}
