import {
    removeSavedSearch,
    saveSearch,
    type SavedSearch,
    type SearchNotificationFrequency,
} from "../../../domain/searches/savedSearches";
import { trackTelemetry } from "../../../domain/telemetry/client";
import { writeClipboardText } from "../../../platform/clipboard";
import { createSvgIcon, createUiButton } from "../../../ui/elements";
import {
    replaceWithSavedSearchBellFilledIcon,
    replaceWithSavedSearchBellIcon,
    replaceWithSavedSearchShareIcon,
    replaceWithSavedSearchTrashIcon,
} from "../../../ui/icons";
import { openPopover } from "../../../ui/popover";
import { showToast } from "../../../ui/toast";
import { createSearchShareUrl } from "../../filters/shareLink";
import { openSavedSearchAlertPopover } from "../alertPopover";
import type { SavedSearchActions } from "./types";

interface NativeShareData {
    title: string;
    url: string;
}

function canUseNativeShare(data: NativeShareData): boolean {
    if (typeof navigator.share !== "function") return false;
    return typeof navigator.canShare !== "function" || navigator.canShare(data);
}

async function tryNativeShare(data: NativeShareData): Promise<boolean> {
    try {
        await navigator.share!(data);
        return true;
    } catch (error) {
        return error instanceof DOMException && error.name === "AbortError";
    }
}

function openShareOptions(
    anchor: HTMLElement,
    data: NativeShareData,
    signal: AbortSignal,
    onCopy: () => Promise<void>,
): void {
    const content = document.createElement("div");
    const titleRow = document.createElement("div");
    const heading = document.createElement("h2");
    const copy = createUiButton({ label: "Copy link", variant: "secondary" });
    const email = createUiButton({ label: "Email", variant: "secondary" });

    content.className = "edf-share-options";
    titleRow.className = "edf-dialog-title-row";
    heading.textContent = "Share this search";
    copy.classList.add("edf-share-options-action");
    email.classList.add("edf-share-options-action");
    copy.addEventListener("click", () => {
        void onCopy().then(() => popover.close());
    }, { signal });
    email.addEventListener("click", () => {
        window.open(
            `mailto:?subject=${encodeURIComponent(data.title)}&body=${encodeURIComponent(data.url)}`,
            "_blank",
            "noopener,noreferrer",
        );
        popover.close();
    }, { signal });
    titleRow.append(createSvgIcon(replaceWithSavedSearchShareIcon), heading);
    content.append(titleRow, copy, email);
    const popover = openPopover({ anchor, content, label: "Share this search", signal });
}

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
            .catch(error => {
                const message = error instanceof Error ? error.message : "Could not delete saved search";
                if (!/cancelled/i.test(message)) notify(actions, message);
            })
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
            const copyLink = async (): Promise<void> => {
                await writeClipboardText(url);
                notify(actions, "Search link copied");
            };
            const shareData: NativeShareData = { title: search.title, url };
            if (canUseNativeShare(shareData) && await tryNativeShare(shareData)) return;
            openShareOptions(button, shareData, signal, copyLink);
        } finally {
            button.disabled = false;
            button.blur();
        }
    }, { signal });
    return button;
}
