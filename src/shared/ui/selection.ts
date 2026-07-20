export interface SelectionControlOptions {
    actions?: readonly SelectionAction[];
    buttonClassName: string;
    clearLabel?: string;
    controls: HTMLElement;
    onClear(ids: readonly string[]): void;
    onSelectionChange(ids: readonly string[]): void;
    selectedIds: readonly string[];
    visibleIds: readonly string[];
}

export interface SelectionAction {
    label: string;
    onAction(ids: readonly string[]): void;
}

function createButton(className: string): HTMLButtonElement {
    const button = document.createElement("button");

    button.type = "button";
    button.className = className;

    return button;
}

export function createSelectionCheckbox(
    checked: boolean,
    labelText: string,
    onChange: (checked: boolean) => void,
): HTMLLabelElement {
    const label = document.createElement("label");
    const input = document.createElement("input");

    label.className = "edf-selection-checkbox";
    input.type = "checkbox";
    input.checked = checked;
    input.ariaLabel = labelText;
    for (const eventName of ["pointerdown", "pointerup", "click"] as const) {
        label.addEventListener(eventName, event => event.stopPropagation(), { capture: true });
        input.addEventListener(eventName, event => event.stopPropagation(), { capture: true });
    }
    input.addEventListener("change", event => {
        event.stopPropagation();
        onChange(input.checked);
    });
    label.append(input);

    return label;
}

export function renderSelectionControls(options: SelectionControlOptions): void {
    const selected = new Set(options.selectedIds);
    const visible = options.visibleIds;
    const selectedVisibleCount = visible.filter(id => selected.has(id)).length;
    const selectAllButton = createButton(options.buttonClassName);
    const clearButton = createButton(options.buttonClassName);

    selectAllButton.textContent = selectedVisibleCount === visible.length ? "Deselect all" : "Select all";
    selectAllButton.hidden = visible.length === 0;
    selectAllButton.addEventListener("click", () => {
        options.onSelectionChange(
            selectedVisibleCount === visible.length
                ? []
                : visible,
        );
    });

    clearButton.ariaLabel = options.clearLabel ?? "Clear selected listings";
    clearButton.textContent = options.clearLabel ?? "Clear selection";
    clearButton.hidden = selectedVisibleCount === 0;
    clearButton.addEventListener("click", () => {
        options.onClear(visible.filter(id => selected.has(id)));
    });

    const actionButtons = (options.actions ?? []).map(action => {
        const button = createButton(options.buttonClassName);
        button.textContent = action.label;
        button.hidden = selectedVisibleCount === 0;
        button.addEventListener("click", () => action.onAction(visible.filter(id => selected.has(id))));
        return button;
    });

    options.controls.replaceChildren(...actionButtons, clearButton, selectAllButton);
}
