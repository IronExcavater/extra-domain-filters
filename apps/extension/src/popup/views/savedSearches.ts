import {
    removeSavedSearch,
    saveSearch,
    type SavedSearch,
} from "../../domain/searches/savedSearches";
import { createSavedSearchCollection } from "../../features/saved-searches/collection";
import type { DomainSessionState } from "../../platform/domainPageClient";
import { sendExtensionMessage } from "../../platform/messaging";
import { showPopupToast } from "../toast";

export function createSavedSearchesView(
    searches: readonly SavedSearch[],
    selectedIds: Set<string>,
    signal: AbortSignal,
    animate = true,
    domainSession: DomainSessionState = { status: "unavailable" },
): HTMLElement {
    const collection = createSavedSearchCollection({
        animate,
        cardsClassName: "edf-popup-search-grid",
        className: "edf-popup-content",
        density: "compact",
        items: searches,
        onNotify: showPopupToast,
        title: "My searches",
        onRemove: async search => {
            // Through the background, which closes its hidden Domain tab even if the popup doesn't last.
            if (search.domainId) await sendExtensionMessage("domain-saved-search:remove", { domainId: search.domainId });
            await removeSavedSearch(search.id);
        },
        onSave: async search => {
            await sendExtensionMessage("domain-alert:apply", { frequency: search.notificationFrequency, search });
            await saveSearch({ ...search, id: search.id });
        },
        openLinksInNewTab: true,
        selectedIds,
        signal,
    }).element;
    if (domainSession.status === "signed-out") collection.prepend(createSignInNotice());
    return collection;
}

/** Signed out of Domain is the one session state worth interrupting the list for. */
function createSignInNotice(): HTMLElement {
    const notice = document.createElement("p");
    const link = document.createElement("a");
    notice.className = "edf-popup-domain-notice";
    notice.append("Sign in to Domain.com.au to sync your saved searches and alerts.");
    link.href = "https://www.domain.com.au/user/saved-searches";
    link.target = "_blank";
    link.rel = "noopener noreferrer";
    link.textContent = "Sign in";
    notice.append(link);
    return notice;
}
