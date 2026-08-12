import { Property } from "../../../state/property";

export function createCheckboxProperty(
    input: HTMLInputElement
): Property<'boolean'> {
    return Property.from('boolean', {
        get: () => input.checked,
        set: checked => {
            input.checked = checked;
        },
        observe: notify => {
            const handleChange = () => notify(input.checked);

            input.addEventListener('change', handleChange);
            return () => input.removeEventListener('change', handleChange);
        }
    });
}
