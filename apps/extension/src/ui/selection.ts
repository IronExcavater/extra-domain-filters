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
const MOTION: KeyframeAnimationOptions = { duration: 240, easing: "cubic-bezier(0.2, 0, 0, 1)" };
const FADE: KeyframeAnimationOptions = { duration: 180, easing: "ease" };
const pendingHides = new WeakMap<HTMLButtonElement, Animation>();

type SelectAllState = "all" | "none" | "some";

function prefersReducedMotion(): boolean {
    return window.matchMedia("(prefers-reduced-motion: reduce)").matches;
}

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

/** The button at its natural size, or folded to nothing (its gap included), so showing or
 * hiding it slides its neighbours along instead of making them jump. */
function sizeFrame(button: HTMLButtonElement, open: boolean): Keyframe {
    if (!open) {
        const gap = Number.parseFloat(getComputedStyle(button.parentElement ?? button).columnGap) || 0;
        return {
            borderLeftWidth: "0px",
            borderRightWidth: "0px",
            marginRight: `${-gap}px`,
            opacity: 0,
            paddingLeft: "0px",
            paddingRight: "0px",
            width: "0px",
        };
    }
    const style = getComputedStyle(button);
    return {
        borderLeftWidth: style.borderLeftWidth,
        borderRightWidth: style.borderRightWidth,
        marginRight: "0px",
        opacity: 1,
        paddingLeft: style.paddingLeft,
        paddingRight: style.paddingRight,
        width: `${button.getBoundingClientRect().width}px`,
    };
}

function setControlVisible(button: HTMLButtonElement, visible: boolean): void {
    if (button.dataset.edfSelectionVisible === String(visible)) return;
    button.dataset.edfSelectionVisible = String(visible);

    // Shown again while still folding away: unfold from where it is.
    const pending = pendingHides.get(button);
    if (pending) {
        pendingHides.delete(button);
        if (visible) {
            pending.onfinish = () => pending.cancel();
            pending.reverse();
            return;
        }
        pending.cancel();
    }

    // A control rendered for the first time (e.g. "Select all" on page load) appears in its
    // final state; only later changes animate.
    if (!button.isConnected || prefersReducedMotion()) {
        button.hidden = !visible;
        return;
    }

    if (visible) {
        button.hidden = false;
        button.animate([sizeFrame(button, false), sizeFrame(button, true)], MOTION);
        return;
    }

    const hide = button.animate([sizeFrame(button, true), sizeFrame(button, false)], { ...MOTION, fill: "forwards" });
    pendingHides.set(button, hide);
    hide.onfinish = () => {
        pendingHides.delete(button);
        button.hidden = true;
        hide.cancel();
    };
}

/** Changes a button's label with a plain crossfade, while the button eases to its new width. */
function setControlLabel(button: HTMLButtonElement, text: string): void {
    const current = button.querySelector<HTMLElement>(":scope > .edf-selection-action-label:not([data-leaving])");
    if (current?.textContent === text) return;

    const next = document.createElement("span");
    next.className = "edf-selection-action-label";
    next.textContent = text;
    if (!current || button.hidden || !button.isConnected || prefersReducedMotion()) {
        button.querySelectorAll(":scope > .edf-selection-action-label").forEach(label => label.remove());
        button.append(next);
        return;
    }

    const from = button.getBoundingClientRect().width;
    current.style.left = `${current.offsetLeft}px`;
    current.style.top = `${current.offsetTop}px`;
    current.dataset.leaving = "true";
    current.after(next);
    const to = button.getBoundingClientRect().width;
    if (from !== to) button.animate([{ width: `${from}px` }, { width: `${to}px` }], MOTION);
    current.animate([{ opacity: 1 }, { opacity: 0 }], FADE).onfinish = () => current.remove();
    next.animate([{ opacity: 0 }, { opacity: 1 }], FADE);
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

    const toggleVisibleSelection = (): void => {
        options.onSelectionChange(
            selectedVisibleCount === visible.length
                ? []
                : visible,
        );
    };

    const selectAllState: SelectAllState = selectedVisibleCount === 0
        ? "none"
        : selectedVisibleCount === visible.length ? "all" : "some";
    selectAllButton.ariaPressed = selectAllState === "some" ? "mixed" : String(selectAllState === "all");
    setControlLabel(selectAllButton, selectAllState === "all" ? "Deselect all" : "Select all");
    setControlVisible(selectAllButton, visible.length > 0);
    // It acts on pointer down, so it answers at once; the click that follows is then skipped.
    // The flag sits on the button: the controls can re-render between the two events.
    selectAllButton.onpointerdown = event => {
        event.preventDefault();
        event.stopPropagation();
        selectAllButton.dataset.edfHandledOnPointer = "true";
        toggleVisibleSelection();
    };
    selectAllButton.onclick = event => {
        event.preventDefault();
        event.stopPropagation();
        if (selectAllButton.dataset.edfHandledOnPointer === "true") {
            delete selectAllButton.dataset.edfHandledOnPointer;
            return;
        }
        toggleVisibleSelection();
    };

    clearButton.ariaLabel = options.clearLabel ?? "Clear selected listings";
    setControlLabel(clearButton, options.clearLabel ?? "Clear selection");
    setControlVisible(clearButton, selectedVisibleCount > 0);
    clearButton.onclick = event => {
        event.preventDefault();
        event.stopPropagation();
        options.onClear(visible.filter(id => selected.has(id)));
    };

    const actionButtons = (options.actions ?? []).map((action, index) => {
        const button = getControlButton(options.controls, `action-${index}`, options.buttonClassName);
        setControlLabel(button, action.label);
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
    // Select all stays first, on the left; the actions for a selection unfold after it.
    // Only nodes out of place move, so running animations aren't cut off.
    [selectAllButton, ...actionButtons, clearButton].forEach((button, index) => {
        const slot = options.controls.children[index] ?? null;
        if (slot !== button) options.controls.insertBefore(button, slot);
    });
}
