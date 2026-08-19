import type {
    SavedSearch,
    SearchNotificationFrequency,
} from "../../domain/searches/savedSearches";
import { createUiButton } from "../../ui/elements";
import { openPopover, type PopoverHandle } from "../../ui/popover";
import { createDropdownControl } from "../../ui/sort";

export interface SavedSearchAlertPopoverOptions {
    anchor: HTMLElement;
    mode: "create" | "edit";
    onDelete?(): Promise<void>;
    onSave(frequency: SearchNotificationFrequency): Promise<void>;
    search: SavedSearch;
    signal?: AbortSignal;
}

function getErrorMessage(error: unknown): string {
    return error instanceof Error ? error.message : "Could not update this alert. Please try again.";
}

export function openSavedSearchAlertPopover(
    options: SavedSearchAlertPopoverOptions,
): Promise<void> {
    return new Promise(resolve => {
        const controller = new AbortController();
        const content = document.createElement("form");
        const heading = document.createElement("h2");
        const description = document.createElement("p");
        const field = document.createElement("div");
        const label = document.createElement("span");
        const error = document.createElement("p");
        const actions = document.createElement("div");
        const cancel = createUiButton({ label: "Cancel", signal: controller.signal, variant: "secondary" });
        const submit = createUiButton({
            label: options.mode === "create" ? "Create" : "Update",
            signal: controller.signal,
            variant: "primary",
        });
        let frequency = options.search.notificationFrequency;
        let settled = false;
        const finish = (): void => {
            if (settled) return;
            settled = true;
            controller.abort();
            resolve();
        };
        const dropdown = createDropdownControl({
            ariaLabel: "Alert frequency",
            onChange: value => {
                frequency = value as SearchNotificationFrequency;
            },
            options: [
                ["daily", "Daily"],
                ["weekly", "Weekly"],
                ["none", "Never"],
            ],
            signal: controller.signal,
            value: frequency,
        });
        const setBusy = (busy: boolean): void => {
            for (const button of content.querySelectorAll<HTMLButtonElement>("button")) {
                button.disabled = busy;
                button.setAttribute("aria-busy", String(busy));
            }
        };
        const run = async (operation: () => Promise<void>): Promise<void> => {
            error.hidden = true;
            setBusy(true);
            try {
                await operation();
                popover.close();
            } catch (cause) {
                error.textContent = getErrorMessage(cause);
                error.hidden = false;
                setBusy(false);
            }
        };

        content.className = "edf-saved-search-alert-popover";
        heading.textContent = options.mode === "create" ? "Create property alert" : "Edit property alert";
        description.textContent = "How often would you like to receive email alerts for this search?";
        field.className = "edf-saved-search-alert-field";
        label.className = "edf-saved-search-alert-label";
        label.textContent = "Email frequency";
        error.className = "edf-saved-search-alert-error";
        error.hidden = true;
        error.role = "alert";
        actions.className = "edf-saved-search-alert-actions";
        cancel.addEventListener("click", () => popover.close(), { signal: controller.signal });
        if (options.mode === "edit" && options.onDelete) {
            const remove = createUiButton({
                label: "Delete",
                signal: controller.signal,
                variant: "danger",
            });
            remove.classList.add("edf-saved-search-alert-delete");
            remove.addEventListener("click", () => void run(options.onDelete!), { signal: controller.signal });
            actions.append(remove);
        }
        actions.append(cancel, submit);
        field.append(label, dropdown.element);
        content.append(heading, description, field, error, actions);
        content.addEventListener("submit", event => {
            event.preventDefault();
            void run(() => options.onSave(frequency));
        }, { signal: controller.signal });
        const popover: PopoverHandle = openPopover({
            anchor: options.anchor,
            content,
            label: heading.textContent,
            onClose: finish,
            signal: options.signal,
        });
    });
}
