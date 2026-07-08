import { Property } from "../shared/property";

export function createTextProperty(
    input: HTMLInputElement,
): Property<'string'> {
    return Property.from('string', {
        get: () => input.value,

        set: value => {
            input.value = value;
        },

        observe: notify => {
            const handleChange = () => void notify(input.value);

            input.addEventListener('change', handleChange);
            return () => input.removeEventListener('change', handleChange);
        },
    });
}