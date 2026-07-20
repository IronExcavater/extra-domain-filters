export interface SelectionControlOptions {
    allCount: number;
    buttonClassName: string;
    clearAllLabel?: string;
    clearSelectedLabel?: string;
    controls: HTMLElement;
    mode: boolean;
    onClear(ids: readonly string[]): void;
    onModeChange(active: boolean): void;
    onSelectionChange(ids: readonly string[]): void;
    selectedIds: readonly string[];
    visibleIds: readonly string[];
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
    input.addEventListener("change", () => onChange(input.checked));
    label.append(input);

    return label;
}

export function renderSelectionControls(options: SelectionControlOptions): void {
    const selected = new Set(options.selectedIds);
    const visible = options.visibleIds;
    const selectedVisibleCount = visible.filter(id => selected.has(id)).length;
    const selectionButton = createButton(options.buttonClassName);
    const selectAllButton = createButton(options.buttonClassName);
    const clearButton = createButton(options.buttonClassName);

    selectionButton.textContent = options.mode ? "Cancel selection" : "Select";
    selectionButton.addEventListener("click", () => options.onModeChange(!options.mode));

    selectAllButton.hidden = !options.mode;
    selectAllButton.textContent = selectedVisibleCount === visible.length ? "Deselect all" : "Select all";
    selectAllButton.addEventListener("click", () => {
        options.onSelectionChange(
            selectedVisibleCount === visible.length
                ? []
                : visible,
        );
    });

    clearButton.ariaLabel = "Clear selected items";
    clearButton.textContent = options.mode
        ? options.clearSelectedLabel ?? "Clear selected"
        : options.clearAllLabel ?? "Clear all";
    clearButton.disabled = options.mode
        ? selectedVisibleCount === 0
        : options.allCount === 0;
    clearButton.addEventListener("click", () => {
        options.onClear(options.mode ? visible.filter(id => selected.has(id)) : visible);
    });

    options.controls.replaceChildren(selectionButton, selectAllButton, clearButton);
}
