import {
    removeSavedSearch,
    saveSearch,
    type SavedSearch,
} from "../../domain/searches/savedSearches";
import { createSavedSearchCollection } from "../../features/saved-searches/collection";
import {
    applyDomainAlertFromExtensionPage,
    type DomainSessionState,
    removeDomainSavedSearchFromExtensionPage,
} from "../../platform/domainPageClient";
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
        onRemove: async search => {
            if (search.domainId) await removeDomainSavedSearchFromExtensionPage(search.domainId);
            await removeSavedSearch(search.id);
        },
        onSave: async search => {
            await applyDomainAlertFromExtensionPage(search, search.notificationFrequency);
            await saveSearch({ ...search, id: search.id });
        },
        openLinksInNewTab: true,
        selectedIds,
        signal,
    }).element;
    if (domainSession.status !== "signed-in") {
        const notice = document.createElement("aside");
        const copy = document.createElement("span");
        const link = document.createElement("a");
        notice.className = "edf-popup-domain-session-notice";
        notice.dataset.status = domainSession.status;
        copy.textContent = domainSession.status === "signed-out"
            ? "Sign in to Domain to keep saved searches up to date."
            : "Saved searches could not be refreshed from Domain.";
        link.href = "https://www.domain.com.au/user/saved-searches";
        link.target = "_blank";
        link.rel = "noopener noreferrer";
        link.textContent = domainSession.status === "signed-out" ? "Sign in to Domain" : "Open Domain";
        notice.append(copy, link);
        collection.prepend(notice);
    }
    return collection;
}
