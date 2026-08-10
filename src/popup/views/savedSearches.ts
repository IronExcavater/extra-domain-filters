import {
    removeSavedSearch,
    saveSearch,
    type SavedSearch,
} from "../../domain/searches/savedSearches";
import { createSavedSearchCollection } from "../../features/saved-searches/collection";
import {
    applyDomainAlertFromExtensionPage,
    removeDomainSavedSearchFromExtensionPage,
} from "../../shared/platform/domainPageClient";
import { showPopupToast } from "../toast";

export function createSavedSearchesView(
    searches: readonly SavedSearch[],
    selectedIds: Set<string>,
    signal: AbortSignal,
    animate = true,
): HTMLElement {
    return createSavedSearchCollection({
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
}
