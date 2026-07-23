import { getSavedSearches, removeSavedSearch, saveSearch, type SavedSearch } from "../../domain/searches/savedSearches";
import { onBodyMutations } from "../../shared/dom/bodyMutations";
import { markOwned } from "../../shared/dom/ownership";
import type { PageContext } from "../../shared/platform/router";
import { onStorageChange } from "../../shared/platform/storage";
import { getSettings } from "../../shared/state/settings";
import { showToast } from "../../shared/ui/toast";
import { cloneActionButton, setActionButtonSelected } from "./clone/action";
import { extractSharedFilterParams } from "./searchParams";

const ALERT_MODAL_SELECTOR = '[role="dialog"][aria-label="modal window"], [role="tooltip"]';
const ALERT_FREQUENCY_LABEL = "Email Frequency";
const ALERT_UPDATE_PROMPT = "How often would you like to receive alerts?";
const NEVER_FREQUENCY = "none";
const boundAlertSignals = new WeakSet<AbortSignal>();
const PAGE_NUMBER_PARAMS = ["page", "pageNumber"];

export interface PropertyAlertSearchContext {
    title: string;
    url: string;
}

let propertyAlertSearchContext: PropertyAlertSearchContext | undefined;

export function setPropertyAlertSearchContext(context: PropertyAlertSearchContext): void {
    propertyAlertSearchContext = context;
}

function getSearchTitle(): string {
    return document.title.replace(/\s*\|\s*Domain$/, "") || "Saved search";
}

function normalizeSearchUrl(value: string): string {
    const url = new URL(value, window.location.origin);
    for (const key of PAGE_NUMBER_PARAMS) url.searchParams.delete(key);
    url.hash = "";
    return url.href;
}

function isCurrentExtensionAlert(search: SavedSearch, url = window.location.href): boolean {
    return !search.domainId &&
        normalizeSearchUrl(search.url) === normalizeSearchUrl(url);
}

async function getCurrentExtensionAlert(url = window.location.href): Promise<SavedSearch | undefined> {
    const searches = await getSavedSearches();
    return searches.find(search => isCurrentExtensionAlert(search, url));
}

function getAlertModal(): HTMLElement | undefined {
    return [...document.querySelectorAll<HTMLElement>(ALERT_MODAL_SELECTOR)]
        .find(modal =>
            modal.textContent?.includes("Create a Property Alert") ||
            modal.textContent?.includes("Edit Property Alert") ||
            modal.textContent?.includes(ALERT_UPDATE_PROMPT)
        );
}

function getFrequencyGroup(modal: HTMLElement): HTMLElement | undefined {
    const button = [...modal.querySelectorAll<HTMLElement>("div")]
        .find(element => element.textContent?.trim() === ALERT_FREQUENCY_LABEL)
        ?.parentElement
        ?.querySelector<HTMLButtonElement>("button[data-selected]");
    const radio = modal.querySelector<HTMLInputElement>('input[name="alert-frequency"]');
    return button?.parentElement ??
        modal.querySelector<HTMLButtonElement>("button[data-selected]")?.parentElement ??
        radio?.parentElement?.parentElement ??
        getDropdownControl(modal)?.parentElement?.parentElement ??
        undefined;
}

function getDropdownControl(modal: HTMLElement): HTMLButtonElement | undefined {
    return modal.querySelector<HTMLButtonElement>('button[role="combobox"]') ?? undefined;
}

function getFrequencyControls(group: HTMLElement): Array<HTMLButtonElement | HTMLInputElement> {
    const buttons = [...group.querySelectorAll<HTMLButtonElement>("button[data-selected]")];
    if (buttons.length > 0) return buttons;

    const radios = [...group.querySelectorAll<HTMLInputElement>('input[name="alert-frequency"]')];
    if (radios.length > 0) return radios;

    const dropdown = group.querySelector<HTMLButtonElement>('button[role="combobox"]');
    return dropdown ? [dropdown] : [];
}

function isNeverSelected(modal: HTMLElement): boolean {
    return [...modal.querySelectorAll<HTMLButtonElement>('[data-edf-alert-frequency="none"], button[data-selected]')]
        .some(button => button.dataset.selected === "true" && button.textContent?.trim() === "Never") ||
        [...modal.querySelectorAll<HTMLInputElement>('input[name="alert-frequency"]')]
            .some(input => input.checked && input.dataset.edfAlertFrequency === NEVER_FREQUENCY);
}

function isNeverDropdownSelected(modal: HTMLElement): boolean {
    const control = getDropdownControl(modal);
    const value = control?.parentElement?.querySelector<HTMLInputElement>("input")?.value;
    const text = control?.textContent?.trim().toLowerCase();

    return text === "never" || text === "i don't want alerts anymore" ||
        value === NEVER_FREQUENCY || value === "DELETE";
}

function closeAlertModal(modal: HTMLElement): void {
    const closeButton = modal.querySelector<HTMLButtonElement>('[data-testid^="modal-controls"]') ??
        modal.querySelector<HTMLButtonElement>("button[type=\"button\"]");

    closeButton?.click();
    if (modal.isConnected) {
        document.body.dispatchEvent(new MouseEvent("mousedown", { bubbles: true }));
        document.body.click();
    }
}

function schedulePropertyAlertButtonRefresh(): void {
    window.setTimeout(() => {
        void updatePropertyAlertButtons();
    }, 150);
}

function selectFrequency(
    modal: HTMLElement,
    selected: HTMLButtonElement | HTMLInputElement,
): void {
    for (const button of modal.querySelectorAll<HTMLButtonElement>("[data-edf-alert-frequency], button[data-selected]")) {
        button.dataset.selected = String(button === selected);
    }
    for (const input of modal.querySelectorAll<HTMLInputElement>('input[name="alert-frequency"]')) {
        input.checked = input === selected;
    }
}

function appendDeleteAlertButton(
    form: HTMLFormElement,
    signal: AbortSignal,
    searchContext: PropertyAlertSearchContext,
): void {
    if (form.querySelector('[data-testid="extra-domain-filters-remove-alert"]')) return;

    const source = form.querySelector<HTMLButtonElement>('button[type="submit"]') ??
        form.querySelector<HTMLButtonElement>("button");
    const button = source
        ? cloneActionButton(source, { label: "Delete", selected: false })
        : document.createElement("button");

    button.type = "button";
    button.className = source?.className.includes("css-1iniab3") ? source.className : "css-1iniab3";
    button.dataset.testid = "extra-domain-filters-remove-alert";
    setButtonText(button, "Delete alert");
    button.ariaLabel = "Delete alert";
    button.title = "Delete alert";
    button.addEventListener("click", event => {
        event.preventDefault();
        event.stopPropagation();
        void removeCurrentExtensionAlert(searchContext.url).then(() => {
            showToast("Property alert deleted");
            const modal = form.closest<HTMLElement>(ALERT_MODAL_SELECTOR);
            if (modal) closeAlertModal(modal);
        });
    }, { signal });
    form.append(markOwned(button, "alert-frequency-remove"));
}

function setExtensionAlertModalMode(modal: HTMLElement, form: HTMLFormElement): void {
    const title = [...modal.querySelectorAll<HTMLElement>("div")]
        .find(element => element.textContent?.trim() === "Create a Property Alert");
    const submit = form.querySelector<HTMLButtonElement>('button[type="submit"]');
    const body = modal.querySelector<HTMLElement>(".css-19fbufk");

    if (title) title.textContent = "Edit Property Alert";
    if (body) body.textContent = ALERT_UPDATE_PROMPT;
    if (submit) {
        setButtonText(submit, "Update");
        submit.ariaLabel = "Update alert";
    }
}

function normalizeDropdownAlert(modal: HTMLElement, form: HTMLFormElement): void {
    for (const option of modal.querySelectorAll<HTMLElement>('[role="option"]')) {
        if (option.textContent?.trim().toLowerCase() === "i don't want alerts anymore") {
            option.textContent = "Never";
        }
    }

    if (!isNeverDropdownSelected(modal)) return;

    const control = getDropdownControl(modal);
    const input = control?.parentElement?.querySelector<HTMLInputElement>("input");
    const submit = form.querySelector<HTMLButtonElement>('button[type="submit"]');

    if (control) control.textContent = "Never";
    if (input) input.value = NEVER_FREQUENCY;
    if (submit) {
        setButtonText(submit, "Update");
        submit.ariaLabel = "Update alert";
    }
}

function enhanceDropdownAlert(
    modal: HTMLElement,
    form: HTMLFormElement,
    searchContext: PropertyAlertSearchContext,
    signal: AbortSignal,
): void {
    const normalize = (): void => normalizeDropdownAlert(modal, form);
    const control = getDropdownControl(modal);

    normalize();
    control?.addEventListener("click", () => window.setTimeout(normalize), { signal });
    const observer = new MutationObserver(normalize);
    observer.observe(modal, { childList: true, characterData: true, subtree: true });
    signal.addEventListener("abort", () => observer.disconnect(), { once: true });

    void getCurrentExtensionAlert(searchContext.url).then(alert => {
        if (!alert || signal.aborted) return;
        modal.dataset.edfHasExtensionAlert = "true";
        appendDeleteAlertButton(form, signal, searchContext);
    });

    form.addEventListener("submit", event => {
        if (!isNeverDropdownSelected(modal)) return;
        event.preventDefault();
        event.stopImmediatePropagation();
        void saveCurrentSearchFromAlert(modal, searchContext);
    }, { capture: true, signal });
}

function setCreateAlertModalMode(modal: HTMLElement, form: HTMLFormElement): void {
    if (!modal.textContent?.includes("Create a Property Alert")) return;

    const title = [...modal.querySelectorAll<HTMLElement>("div")]
        .find(element => element.textContent?.trim() === "Edit Property Alert");
    const submit = form.querySelector<HTMLButtonElement>('button[type="submit"]');
    const body = modal.querySelector<HTMLElement>(".css-19fbufk");

    if (title) title.textContent = "Create a Property Alert";
    if (body) {
        body.textContent = "We'll keep a look out and let you know about properties that match your search, including off-market ones.";
    }
    if (submit) {
        setButtonText(submit, "Create alert");
        submit.ariaLabel = "Create alert";
    }
}

async function saveCurrentSearchFromAlert(
    modal: HTMLElement,
    searchContext: PropertyAlertSearchContext,
): Promise<void> {
    const url = new URL(searchContext.url, window.location.origin);
    const existing = await getCurrentExtensionAlert(url.href);
    await saveSearch({
        filterParams: extractSharedFilterParams(url.searchParams).toString(),
        id: existing?.id,
        notificationFrequency: NEVER_FREQUENCY,
        title: searchContext.title,
        url: url.href,
    });
    await updatePropertyAlertButtons();
    closeAlertModal(modal);
    showToast("Property alert set to never");
}

async function removeCurrentExtensionAlert(url = window.location.href): Promise<void> {
    const existing = await getCurrentExtensionAlert(url);
    if (existing) await removeSavedSearch(existing.id);
    await updatePropertyAlertButtons();
}

function setButtonText(button: HTMLButtonElement, value: string): void {
    const label = [...button.querySelectorAll<HTMLElement>("span")]
        .find(span => !span.querySelector("svg"));
    if (label) label.textContent = value;
    else button.textContent = value;
}

export async function updatePropertyAlertButtons(): Promise<void> {
    const hasExtensionAlert = await getCurrentExtensionAlert(window.location.href) !== undefined;
    for (const button of document.querySelectorAll<HTMLButtonElement>('button[name="property-alert"]')) {
        const extensionManaged = button.dataset.edfExtensionAlertActive === "true";
        if (!extensionManaged) {
            button.dataset.edfNativeAlertSelected = String(
                button.dataset.selected === "true" ||
                /^edit alert$/i.test(button.textContent?.trim() ?? ""),
            );
        }
        const nativeActive = button.dataset.edfNativeAlertSelected === "true";
        const active = hasExtensionAlert || nativeActive;

        button.dataset.edfExtensionAlertActive = String(hasExtensionAlert);
        setActionButtonSelected(button, active);
        setButtonText(button, active ? "Edit alert" : "Create alert");
        button.ariaLabel = active ? "Edit alert" : "Create alert";
    }
}

async function enhanceAlertModal(modal: HTMLElement, signal: AbortSignal): Promise<void> {
    if (modal.dataset.edfAlertEnhanced === "true") return;
    const settings = await getSettings();
    if (!settings.savedSearches.enableNeverFrequency || signal.aborted) return;

    const group = getFrequencyGroup(modal);
    const daily = group && getFrequencyControls(group)[0];
    const form = modal.querySelector<HTMLFormElement>("form");
    if (!group || !daily || !form) return;

    const searchContext = propertyAlertSearchContext ?? {
        title: getSearchTitle(),
        url: window.location.href,
    };

    modal.dataset.edfAlertEnhanced = "true";
    if (getDropdownControl(modal)) {
        enhanceDropdownAlert(modal, form, searchContext, signal);
        return;
    }

    const nativeNever = getFrequencyControls(group)
        .find(control => control.dataset.edfAlertFrequency === NEVER_FREQUENCY ||
            control.closest("label")?.textContent?.trim() === "Never" ||
            control.textContent?.trim() === "Never");
    let never = nativeNever ?? (daily.cloneNode(true) as typeof daily);
    if (!nativeNever) {
        if (never instanceof HTMLButtonElement) {
            setButtonText(never, "Never");
            never.dataset.selected = "false";
            group.append(markOwned(never, "alert-frequency-never"));
        } else {
            const tile = daily.closest("label")?.cloneNode(true) as HTMLLabelElement | undefined;
            const input = tile?.querySelector<HTMLInputElement>('input[name="alert-frequency"]');
            const label = tile?.querySelector<HTMLElement>("span");
            if (!tile || !input || !label) return;
            input.checked = false;
            input.value = NEVER_FREQUENCY;
            label.textContent = "Never";
            input.dataset.edfAlertFrequency = NEVER_FREQUENCY;
            group.append(markOwned(tile, "alert-frequency-never"));
            never = input;
        }
    }
    never.dataset.edfAlertFrequency = NEVER_FREQUENCY;
    never.dataset.edfInjectedFrequency = String(!nativeNever);
    if (never instanceof HTMLButtonElement) never.type = "button";

    for (const control of getFrequencyControls(group)) {
        control.addEventListener("click", event => {
            if (control === never && control instanceof HTMLButtonElement) {
                event.preventDefault();
                event.stopPropagation();
            }
            selectFrequency(modal, control);
        }, { signal });
    }

    void getCurrentExtensionAlert(searchContext.url).then(alert => {
        if (signal.aborted) return;
        modal.dataset.edfHasExtensionAlert = String(alert !== undefined);
        if (alert) {
            selectFrequency(modal, never);
            setExtensionAlertModalMode(modal, form);
            appendDeleteAlertButton(form, signal, searchContext);
        } else {
            setCreateAlertModalMode(modal, form);
        }
    });
    form.addEventListener("submit", event => {
        if (isNeverSelected(modal)) {
            event.preventDefault();
            event.stopImmediatePropagation();
            void saveCurrentSearchFromAlert(modal, searchContext);
            return;
        }
        if (modal.dataset.edfHasExtensionAlert === "true") {
            window.setTimeout(() => {
                void removeCurrentExtensionAlert(searchContext.url).then(() => {
                    showToast("Property alert updated");
                });
            }, 300);
        }
    }, { capture: true, signal });

    for (const close of modal.querySelectorAll<HTMLButtonElement>('[data-testid^="modal-controls"]')) {
        close.addEventListener("click", schedulePropertyAlertButtonRefresh, { signal });
    }
    modal.addEventListener("focusout", schedulePropertyAlertButtonRefresh, { signal });
}

export function bindPropertyAlertModal(context: PageContext): void {
    if (boundAlertSignals.has(context.signal)) return;
    boundAlertSignals.add(context.signal);

    const reconcile = (): void => {
        const modal = getAlertModal();
        if (modal) void enhanceAlertModal(modal, context.signal);
        else void updatePropertyAlertButtons().catch(error =>
            context.logger.warn("Failed to update property alert state", error)
        );
    };

    reconcile();
    onBodyMutations(reconcile, context.signal);
    context.scope.add(onStorageChange("savedSearches", () => {
        void updatePropertyAlertButtons().catch(error =>
            context.logger.warn("Failed to update property alert state", error)
        );
    }));
}
