import { saveSearch, type SavedSearch } from "../../../domain/searches/savedSearches";
import { markOwned } from "../../../shared/dom/ownership";
import { getSettings } from "../../../shared/state/settings";
import { createButton, createSvgIcon } from "../../../shared/ui/elements";
import { replaceWithCloseIcon } from "../../../shared/ui/icons";
import { createDropdownControl } from "../../../shared/ui/sort";
import { showToast } from "../../../shared/ui/toast";
import {
    createCategory,
    createFeatureRow,
    createTitle,
} from "./content";
import {
    getFilterSummary,
} from "./summary";
import type { SavedSearchActions } from "./types";

const DEFAULT_FREQUENCIES = ["daily", "weekly"] as const;
const EXTENSION_FREQUENCIES = [...DEFAULT_FREQUENCIES, "none"] as const;

function getFrequencies(
    search: SavedSearch,
    enableNeverFrequency: boolean,
): readonly SavedSearch["notificationFrequency"][] {
    return enableNeverFrequency || search.notificationFrequency === "none"
        ? EXTENSION_FREQUENCIES
        : DEFAULT_FREQUENCIES;
}

function getFrequencyLabel(frequency: SavedSearch["notificationFrequency"]): string {
    if (frequency === "none") return "Never";
    return frequency[0].toUpperCase() + frequency.slice(1);
}

function createRadioOption(
    groupName: string,
    value: string,
    labelText: string,
    checked: boolean,
): HTMLLabelElement {
    const label = document.createElement("label");
    const input = document.createElement("input");
    const radio = document.createElement("span");
    const radioVisual = document.createElement("span");
    const text = document.createElement("span");

    label.className = "edf-saved-search-radio-option";
    input.type = "radio";
    input.className = "edf-saved-search-radio-input";
    input.name = groupName;
    input.value = value;
    input.checked = checked;
    radio.className = "edf-saved-search-radio-control";
    radioVisual.className = "edf-saved-search-radio-visual";
    text.className = "edf-saved-search-radio-option-label";
    text.textContent = labelText;
    radio.append(radioVisual);
    label.append(input, radio, text);

    return label;
}

function createFrequencyRadio(
    search: SavedSearch,
    frequency: SavedSearch["notificationFrequency"],
): HTMLLabelElement {
    return createRadioOption(
        `edf-alert-frequency-${search.id}`,
        frequency,
        getFrequencyLabel(frequency),
        search.notificationFrequency === frequency,
    );
}

function createSearchPreview(search: SavedSearch): HTMLElement {
    const preview = document.createElement("div");
    const summary = getFilterSummary(search);

    preview.className = "edf-saved-search-alert-preview";
    preview.append(createCategory(summary), createTitle(search), createFeatureRow(summary));

    return preview;
}

function createOffMarketHeading(): HTMLHeadingElement {
    const heading = document.createElement("h3");
    const info = document.createElement("span");

    heading.className = "edf-saved-search-off-market-title";
    heading.append("Off Market");
    info.className = "edf-saved-search-off-market-info";
    info.ariaLabel = "About off-market property alerts";
    info.textContent = "i";
    heading.append(info);

    return heading;
}

async function saveAlert(search: SavedSearch, actions: SavedSearchActions): Promise<void> {
    if (actions.onSave) {
        await actions.onSave(search);
        return;
    }
    await saveSearch({ ...search, id: search.id });
}

export async function openAlertModal(
    search: SavedSearch,
    actions: SavedSearchActions = {},
    anchor?: HTMLElement,
): Promise<void> {
    const settings = await getSettings();
    const frequencies = getFrequencies(search, settings.savedSearches.enableNeverFrequency);
    if (actions.compactAlertModal && anchor) {
        openAlertPopover(search, actions, anchor, frequencies);
        return;
    }
    document.querySelector<HTMLElement>('[data-testid="extra-domain-saved-search-alert-modal"]')?.remove();

    const overlay = document.createElement("div");
    const dialog = document.createElement("div");
    const close = createButton("", "edf-saved-search-modal-close");
    const content = document.createElement("div");
    const title = document.createElement("h2");
    const subtitle = document.createElement("p");
    const radios = document.createElement("div");
    const offMarketTitle = createOffMarketHeading();
    const offMarketRadios = document.createElement("div");
    const actionsRow = document.createElement("div");
    const cancel = createButton("Cancel", "edf-saved-search-modal-button edf-saved-search-modal-button-secondary");
    const update = createButton("Update", "edf-saved-search-modal-button edf-saved-search-modal-button-primary");
    const closeDialog = (): void => overlay.remove();

    overlay.className = "edf-saved-search-modal-root";
    if (actions.compactAlertModal) overlay.dataset.compact = "true";
    overlay.dataset.testid = "extra-domain-saved-search-alert-modal";
    dialog.className = "edf-saved-search-modal-dialog";
    dialog.dataset.testid = "modal-content";
    dialog.setAttribute("aria-label", "Property alert settings");
    dialog.setAttribute("aria-modal", "true");
    dialog.setAttribute("role", "dialog");
    close.ariaLabel = "Close";
    close.dataset.testid = "modal-controls";
    close.append(createSvgIcon(replaceWithCloseIcon));
    close.addEventListener("click", closeDialog);

    content.className = "edf-saved-search-alert-content";
    title.className = "edf-saved-search-modal-title";
    title.textContent = "Get Property Alerts";
    subtitle.className = "edf-saved-search-modal-subtitle";
    subtitle.append("How often would you like to receive ");
    const highlight = document.createElement("strong");
    highlight.textContent = "emails";
    subtitle.append(highlight, " for this search?");

    radios.className = "edf-saved-search-alert-radios";
    radios.append(...frequencies.map(frequency => createFrequencyRadio(search, frequency)));
    offMarketRadios.className = "edf-saved-search-alert-radios";
    offMarketRadios.append(
        createRadioOption(`edf-off-market-${search.id}`, "immediate", "Immediate", true),
        createRadioOption(`edf-off-market-${search.id}`, "daily", "Daily", false),
        createRadioOption(`edf-off-market-${search.id}`, "never", "Never", false),
    );
    actionsRow.className = "edf-saved-search-modal-actions";
    cancel.addEventListener("click", closeDialog);
    update.addEventListener("click", async () => {
        const frequency = radios.querySelector<HTMLInputElement>("input:checked")?.value as
            SavedSearch["notificationFrequency"] | undefined;

        update.disabled = true;
        try {
            await saveAlert({
                ...search,
                notificationFrequency: frequency ?? search.notificationFrequency,
            }, actions);
            if (actions.onNotify) actions.onNotify("Property alert updated");
            else showToast("Property alert updated");
            closeDialog();
        } finally {
            update.disabled = false;
        }
    });

    actionsRow.append(cancel, update);
    content.append(
        title,
        subtitle,
        createSearchPreview(search),
        radios,
        offMarketTitle,
        offMarketRadios,
        actionsRow,
    );
    dialog.append(close, content);
    overlay.append(dialog);
    overlay.addEventListener("click", event => {
        if (event.target === overlay) closeDialog();
    });
    document.body.append(markOwned(overlay, "saved-search-alert-modal"));
}

function openAlertPopover(
    search: SavedSearch,
    actions: SavedSearchActions,
    anchor: HTMLElement,
    frequencyOptions: readonly SavedSearch["notificationFrequency"][],
): void {
    document.querySelector<HTMLElement>('[data-testid="extra-domain-saved-search-alert-popover"]')?.remove();

    const popover = document.createElement("div");
    const title = document.createElement("p");
    const frequencies = document.createElement("div");
    const actionsRow = document.createElement("div");
    const cancel = createButton("Cancel", "edf-saved-search-alert-popover-button");
    const update = createButton("Update", "edf-saved-search-alert-popover-button edf-saved-search-alert-popover-button-primary");
    const scope = new AbortController();
    let selected = search.notificationFrequency;
    const rect = anchor.getBoundingClientRect();
    const onPointerDown = (event: PointerEvent): void => {
        if (!popover.contains(event.target as Node) && event.target !== anchor) close();
    };
    const close = (): void => {
        document.removeEventListener("pointerdown", onPointerDown);
        scope.abort();
        popover.remove();
    };

    popover.className = "edf-saved-search-alert-popover";
    popover.dataset.testid = "extra-domain-saved-search-alert-popover";
    popover.style.right = `${Math.max(12, window.innerWidth - rect.right)}px`;
    popover.style.top = `${rect.bottom + 8}px`;
    title.className = "edf-saved-search-alert-popover-title";
    title.textContent = "Would you like to change how often you receive alerts?";
    frequencies.className = "edf-saved-search-alert-popover-options";
    const dropdown = createDropdownControl({
        ariaLabel: "Alert frequency",
        onChange: frequency => {
            selected = frequency as SavedSearch["notificationFrequency"];
        },
        options: frequencyOptions.map(frequency => [frequency, getFrequencyLabel(frequency)] as const),
        signal: scope.signal,
        value: selected,
    });

    cancel.addEventListener("click", close);
    update.addEventListener("click", async () => {
        update.disabled = true;
        try {
            await saveAlert({ ...search, notificationFrequency: selected }, actions);
            actions.onNotify?.("Property alert updated");
            close();
        } finally {
            update.disabled = false;
        }
    });
    frequencies.append(dropdown.element);
    actionsRow.className = "edf-saved-search-alert-popover-actions";
    actionsRow.append(cancel, update);
    popover.append(title, frequencies, actionsRow);
    document.body.append(markOwned(popover, "saved-search-alert-popover"));

    requestAnimationFrame(() => document.addEventListener("pointerdown", onPointerDown));
}
