import {
    getSavedSearches,
    removeSavedSearch,
    saveSearch,
    type SavedSearch,
} from "../domain/searches/savedSearches";
import { enableStickyHeader } from "../features/navigation";
import {
    createSavedSearchCollection,
    type SavedSearchCollection,
} from "../features/saved-searches/collection";
import { onBodyMutations } from "../shared/dom/bodyMutations";
import { markOwned } from "../shared/dom/ownership";
import { createFrameReconciler } from "../shared/dom/reconcile";
import { domainAlertBridge } from "../shared/domain/alerts";
import {
    findDomainSavedSearchAlertTrigger,
    findDomainSavedSearchHost,
    removeDomainSavedSearch,
    restoreDomainSavedSearches,
    syncDomainSavedSearches,
} from "../shared/domain/savedSearches";
import type { PageMount } from "../shared/platform/router";
import { onStorageChange } from "../shared/platform/storage";
import { showToast } from "../shared/ui/toast";

const selectedSearchIds = new Set<string>();

async function removeSearch(search: SavedSearch): Promise<void> {
    if (search.domainId) await removeDomainSavedSearch(search.domainId);
    await removeSavedSearch(search.id);
}

async function saveAlert(search: SavedSearch, signal: AbortSignal): Promise<void> {
    if (search.domainId) {
        const trigger = findDomainSavedSearchAlertTrigger(search.domainId);
        if (!trigger) throw new Error("Domain's alert control is unavailable for this search.");
        const result = await domainAlertBridge.apply({
            frequency: search.notificationFrequency,
            signal,
            trigger,
        });
        if (!result.ok) throw new Error(result.message);
    }
    await saveSearch({ ...search, id: search.id });
}

const mountSavedSearchesPage: PageMount = context => {
    enableStickyHeader(context);
    let collection: SavedSearchCollection | undefined;

    const reconcile = createFrameReconciler(context.scope, async () => {
        const searches = await syncDomainSavedSearches(await getSavedSearches());
        if (collection) {
            collection.replaceItems(searches);
            return;
        }
        collection = createSavedSearchCollection({
            cardsClassName: "edf-saved-search-list",
            className: "edf-saved-search-page-collection",
            items: searches,
            onNotify: showToast,
            onRemove: removeSearch,
            onSave: search => saveAlert(search, context.signal),
            selectedIds: selectedSearchIds,
            signal: context.signal,
        });
        const host = findDomainSavedSearchHost();
        const heading = host.querySelector("h1");
        const element = markOwned(collection.element, "saved-search-collection");
        if (heading) heading.after(element);
        else host.append(element);
    }, error => context.logger.error("Could not render saved searches", error));

    onBodyMutations(reconcile.schedule, context.signal);
    context.scope.add(onStorageChange("savedSearches", reconcile.schedule));
    context.scope.add(() => {
        if (document.documentElement.dataset.edfExtensionReload === "true") return;
        restoreDomainSavedSearches();
        collection?.element.remove();
    });
    reconcile.schedule();
};

export default mountSavedSearchesPage;
