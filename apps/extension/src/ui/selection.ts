import { markOwned } from "../dom/ownership";
import { createButton, createSvgIcon } from "./elements";
import { replaceWithCheckIcon } from "./icons";

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

const CHECKBOX_TRANSITION_MS = 160;
const visibilityTimers = new WeakMap<HTMLButtonElement, number>();

function getControlButton(
    controls: HTMLElement,
    key: string,
    className: string,
): HTMLButtonElement {
    const existing = controls.querySelector<HTMLButtonElement>(
        `[data-edf-selection-control="${CSS.escape(key)}"]`,
    );
    if (existing) return existing;
    const button = createButton("", className);
    button.dataset.edfSelectionControl = key;
    button.dataset.edfSelectionVisible = "false";
    button.hidden = true;
    return button;
}

function setControlVisible(button: HTMLButtonElement, visible: boolean): void {
    const pending = visibilityTimers.get(button);
    if (pending !== undefined) window.clearTimeout(pending);

    if (visible) {
        button.hidden = false;
        requestAnimationFrame(() => {
            if (button.isConnected) button.dataset.edfSelectionVisible = "true";
        });
        return;
    }

    button.dataset.edfSelectionVisible = "false";
    visibilityTimers.set(button, window.setTimeout(() => {
        if (button.dataset.edfSelectionVisible === "false") button.hidden = true;
        visibilityTimers.delete(button);
    }, CHECKBOX_TRANSITION_MS));
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
    let pendingCommit: number | undefined;

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
        const checked = input.checked;
        label.dataset.checked = String(checked);
        if (pendingCommit !== undefined) window.clearTimeout(pendingCommit);
        // Collection views rebuild their cards after selection changes. Commit after the
        // visual transition so the checked background and tick can fade before replacement.
        pendingCommit = window.setTimeout(() => {
            pendingCommit = undefined;
            onChange(checked);
        }, CHECKBOX_TRANSITION_MS);
    });
    indicator.className = "edf-selection-checkbox-indicator";
    indicator.ariaHidden = "true";
    indicator.append(createSvgIcon(replaceWithCheckIcon, "edf-selection-checkbox-icon"));
    label.append(input, indicator);

    return markOwned(label, "selection-checkbox");
}

export function renderSelectionControls(options: SelectionControlOptions): void {
    const selected = new Set(options.selectedIds);
    const visible = options.visibleIds;
    const selectedVisibleCount = visible.filter(id => selected.has(id)).length;
    const selectAllButton = getControlButton(options.controls, "select-all", options.buttonClassName);
    const clearButton = getControlButton(options.controls, "clear", options.buttonClassName);
    let selectAllHandledOnPointer = false;

    const toggleVisibleSelection = (): void => {
        options.onSelectionChange(
            selectedVisibleCount === visible.length
                ? []
                : visible,
        );
    };

    selectAllButton.textContent = selectedVisibleCount === visible.length ? "Deselect all" : "Select all";
    setControlVisible(selectAllButton, visible.length > 0);
    selectAllButton.onpointerdown = event => {
        event.preventDefault();
        event.stopPropagation();
        selectAllHandledOnPointer = true;
        toggleVisibleSelection();
    };
    selectAllButton.onclick = event => {
        event.preventDefault();
        event.stopPropagation();
        if (selectAllHandledOnPointer) return;
        toggleVisibleSelection();
    };

    clearButton.ariaLabel = options.clearLabel ?? "Clear selected listings";
    clearButton.textContent = options.clearLabel ?? "Clear selection";
    setControlVisible(clearButton, selectedVisibleCount > 0);
    clearButton.onclick = event => {
        event.preventDefault();
        event.stopPropagation();
        options.onClear(visible.filter(id => selected.has(id)));
    };

    const actionButtons = (options.actions ?? []).map((action, index) => {
        const button = getControlButton(options.controls, `action-${index}`, options.buttonClassName);
        button.textContent = action.label;
        setControlVisible(button, selectedVisibleCount > 0);
        button.onclick = event => {
            event.preventDefault();
            event.stopPropagation();
            action.onAction(visible.filter(id => selected.has(id)));
        };
        return button;
    });

    options.controls.querySelectorAll<HTMLButtonElement>('[data-edf-selection-control^="action-"]')
        .forEach(button => {
            if (!actionButtons.includes(button)) button.remove();
        });
    options.controls.append(...actionButtons, clearButton, selectAllButton);
}
