import { markOwned } from "../dom/ownership";
import { createButton } from "./elements";

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

export function replaceSelection(selection: Set<string>, ids: readonly string[]): void {
    selection.clear();
    ids.forEach(id => selection.add(id));
}

export function setSelectionCheckboxState(input: HTMLInputElement, checked: boolean): void {
    input.checked = checked;
    const label = input.closest<HTMLElement>(".edf-selection-checkbox");
    if (label) label.dataset.checked = String(checked);
}

export function createSelectionCheckbox(
    checked: boolean,
    labelText: string,
    onChange: (checked: boolean) => void,
): HTMLLabelElement {
    const label = document.createElement("label");
    const input = document.createElement("input");
    const indicator = document.createElement("span");

    label.className = "edf-selection-checkbox";
    input.type = "checkbox";
    input.checked = checked;
    label.dataset.checked = String(checked);
    input.ariaLabel = labelText;
    for (const eventName of ["pointerdown", "pointerup", "click"] as const) {
        label.addEventListener(eventName, event => event.stopPropagation(), { capture: true });
        input.addEventListener(eventName, event => event.stopPropagation(), { capture: true });
    }
    input.addEventListener("change", event => {
        event.stopPropagation();
        label.dataset.checked = String(input.checked);
        onChange(input.checked);
    });
    indicator.className = "edf-selection-checkbox-indicator";
    indicator.ariaHidden = "true";
    indicator.textContent = "\u2713";
    label.append(input, indicator);

    return markOwned(label, "selection-checkbox");
}

export function renderSelectionControls(options: SelectionControlOptions): void {
    const selected = new Set(options.selectedIds);
    const visible = options.visibleIds;
    const selectedVisibleCount = visible.filter(id => selected.has(id)).length;
    const selectAllButton = createButton("", options.buttonClassName);
    const clearButton = createButton("", options.buttonClassName);
    let selectAllHandledOnPointer = false;

    const toggleVisibleSelection = (): void => {
        options.onSelectionChange(
            selectedVisibleCount === visible.length
                ? []
                : visible,
        );
    };

    selectAllButton.textContent = selectedVisibleCount === visible.length ? "Deselect all" : "Select all";
    selectAllButton.hidden = visible.length === 0;
    selectAllButton.addEventListener("pointerdown", event => {
        event.preventDefault();
        event.stopPropagation();
        selectAllHandledOnPointer = true;
        toggleVisibleSelection();
    });
    selectAllButton.addEventListener("click", event => {
        event.preventDefault();
        event.stopPropagation();
        if (selectAllHandledOnPointer) return;
        toggleVisibleSelection();
    });

    clearButton.ariaLabel = options.clearLabel ?? "Clear selected listings";
    clearButton.textContent = options.clearLabel ?? "Clear selection";
    clearButton.hidden = selectedVisibleCount === 0;
    clearButton.addEventListener("click", event => {
        event.preventDefault();
        event.stopPropagation();
        options.onClear(visible.filter(id => selected.has(id)));
    });

    const actionButtons = (options.actions ?? []).map(action => {
        const button = createButton("", options.buttonClassName);
        button.textContent = action.label;
        button.hidden = selectedVisibleCount === 0;
        button.addEventListener("click", event => {
            event.preventDefault();
            event.stopPropagation();
            action.onAction(visible.filter(id => selected.has(id)));
        });
        return button;
    });

    options.controls.replaceChildren(...actionButtons, clearButton, selectAllButton);
}
