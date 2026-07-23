import {
    removeSavedSearch,
    type SavedSearch,
} from "../../../domain/searches/savedSearches";
import { markOwned } from "../../../shared/dom/ownership";
import { writeClipboardText } from "../../../shared/platform/clipboard";
import { createButton, createIconButton } from "../../../shared/ui/elements";
import {
    replaceWithSavedSearchBellFilledIcon,
    replaceWithSavedSearchBellIcon,
    replaceWithSavedSearchTrashIcon,
} from "../../../shared/ui/icons";
import { showToast } from "../../../shared/ui/toast";
import { createSearchShareUrl } from "../../filters/shareLink";
import { openAlertModal } from "./modal";
import type { SavedSearchActions } from "./types";

function notify(actions: SavedSearchActions, message: string): void {
    if (actions.onNotify) actions.onNotify(message);
    else showToast(message);
}

async function removeSearch(search: SavedSearch, actions: SavedSearchActions): Promise<void> {
    if (actions.onRemove) {
        await actions.onRemove(search);
        return;
    }
    await removeSavedSearch(search.id);
}

export function createNotificationButton(
    search: SavedSearch,
    actions: SavedSearchActions = {},
): HTMLButtonElement {
    const active = search.notificationFrequency !== "none";
    const button = createIconButton(
        "Change saved search frequency",
        active ? replaceWithSavedSearchBellFilledIcon : replaceWithSavedSearchBellIcon,
        "edf-saved-search-notification",
    );

    button.dataset.active = String(active);
    button.dataset.testid = active
        ? "saved-searches__entry--notification-on"
        : "saved-searches__entry--notification-off";
    button.addEventListener("click", event => {
        event.preventDefault();
        event.stopPropagation();
        openAlertModal(search, actions, button);
    });

    return button;
}

export function createDeleteButton(
    search: SavedSearch,
    signal: AbortSignal,
    actions: SavedSearchActions = {},
): HTMLButtonElement {
    const button = createIconButton(
        "Remove saved search",
        replaceWithSavedSearchTrashIcon,
        "edf-saved-search-delete",
    );

    button.addEventListener("click", event => {
        event.preventDefault();
        event.stopPropagation();
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
    const button = createButton("Share", "edf-saved-search-action");

    button.dataset.testid = "saved-searches__share";
    button.addEventListener("click", async event => {
        event.preventDefault();
        event.stopPropagation();
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

    return markOwned(button, "saved-search-share");
}
