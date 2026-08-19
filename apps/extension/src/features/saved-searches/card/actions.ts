import {
    removeSavedSearch,
    saveSearch,
    type SavedSearch,
    type SearchNotificationFrequency,
} from "../../../domain/searches/savedSearches";
import { trackTelemetry } from "../../../domain/telemetry/client";
import { writeClipboardText } from "../../../platform/clipboard";
import { createUiButton } from "../../../ui/elements";
import {
    replaceWithSavedSearchBellFilledIcon,
    replaceWithSavedSearchBellIcon,
    replaceWithSavedSearchShareIcon,
    replaceWithSavedSearchTrashIcon,
} from "../../../ui/icons";
import { showToast } from "../../../ui/toast";
import { createSearchShareUrl } from "../../filters/shareLink";
import { openSavedSearchAlertPopover } from "../alertPopover";
import type { SavedSearchActions } from "./types";

function notify(actions: SavedSearchActions, message: string): void {
    if (actions.onNotify) actions.onNotify(message);
    else showToast(message);
}

async function removeSearch(search: SavedSearch, actions: SavedSearchActions): Promise<void> {
    if (actions.onRemove) await actions.onRemove(search);
    else await removeSavedSearch(search.id);
}

async function saveFrequency(
    search: SavedSearch,
    frequency: SearchNotificationFrequency,
    actions: SavedSearchActions,
): Promise<void> {
    const next = { ...search, notificationFrequency: frequency };
    if (actions.onSave) await actions.onSave(next);
    else await saveSearch({ ...next, id: next.id });
    notify(actions, frequency === "none" ? "Email alerts disabled" : `Alert frequency set to ${frequency}`);
}

export function createNotificationButton(
    search: SavedSearch,
    signal: AbortSignal,
    actions: SavedSearchActions = {},
): HTMLButtonElement {
    const active = search.notificationFrequency !== "none";
    const button = createUiButton({
        ariaLabel: "Change saved search frequency",
        className: "edf-saved-search-card-action edf-saved-search-notification",
        icon: active ? replaceWithSavedSearchBellFilledIcon : replaceWithSavedSearchBellIcon,
        signal,
        tooltip: "Change alert frequency",
        variant: "icon",
    });

    button.dataset.active = String(active);
    button.dataset.testid = active
        ? "saved-searches__entry--notification-on"
        : "saved-searches__entry--notification-off";
    button.addEventListener("click", event => {
        event.preventDefault();
        event.stopPropagation();
        void trackTelemetry({ name: "feature_used", feature: "saved_search_frequency" });
        if (actions.onEditAlert) {
            void actions.onEditAlert(search, button);
            return;
        }
        void openSavedSearchAlertPopover({
            anchor: button,
            mode: "edit",
            onDelete: async () => {
                await removeSearch(search, actions);
                notify(actions, "Saved search deleted");
            },
            onSave: frequency => saveFrequency(search, frequency, actions),
            search,
            signal,
        });
    }, { signal });
    return button;
}

export function createDeleteButton(
    search: SavedSearch,
    signal: AbortSignal,
    actions: SavedSearchActions = {},
): HTMLButtonElement {
    const button = createUiButton({
        ariaLabel: "Remove saved search",
        className: "edf-saved-search-card-action edf-saved-search-delete",
        icon: replaceWithSavedSearchTrashIcon,
        signal,
        tooltip: "Remove saved search",
        variant: "icon",
    });

    button.addEventListener("click", () => {
        void trackTelemetry({ name: "feature_used", feature: "saved_search_delete" });
        button.disabled = true;
        void removeSearch(search, actions)
            .then(() => notify(actions, "Saved search deleted"))
            .finally(() => {
                button.disabled = false;
            });
    }, { signal });
    return button;
}

export function createShareButton(
    search: SavedSearch,
    signal: AbortSignal,
    actions: SavedSearchActions = {},
): HTMLButtonElement {
    const button = createUiButton({
        ariaLabel: "Copy saved search link",
        className: "edf-saved-search-card-action edf-saved-search-share",
        icon: replaceWithSavedSearchShareIcon,
        signal,
        tooltip: "Share saved search",
        variant: "icon",
    });

    button.dataset.testid = "saved-searches__share";
    button.addEventListener("click", async () => {
        void trackTelemetry({ name: "feature_used", feature: "saved_search_share" });
        button.disabled = true;
        try {
            const url = await createSearchShareUrl(
                search.url,
                new URLSearchParams(search.filterParams),
            );
            await writeClipboardText(url);
            notify(actions, "Search link copied");
        } finally {
            button.disabled = false;
            button.blur();
        }
    }, { signal });
    return button;
}
