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
    // Session state is shown by the header's Domain chip; kept for the call signature.
    _domainSession: DomainSessionState = { status: "unavailable" },
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
    return collection;
}
