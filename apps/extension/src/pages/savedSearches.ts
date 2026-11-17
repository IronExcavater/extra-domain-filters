import { onBodyMutations } from "../dom/bodyMutations";
import { waitForHydration } from "../dom/wait";
import { markOwned } from "../dom/ownership";
import { createFrameReconciler } from "../dom/reconcile";
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
import type { PageMount } from "../platform/router";
import { onStorageChange } from "../platform/storage";
import { domainAlertBridge } from "../site-dom/alerts";
import {
    findDomainSavedSearchAlertTrigger,
    findDomainSavedSearchHost,
    removeDomainSavedSearch,
    restoreDomainSavedSearches,
    syncDomainSavedSearches,
} from "../site-dom/savedSearches";
import { showToast } from "../ui/toast";

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
    let hydrated = false;

    const reconcile = createFrameReconciler(context.scope, async () => {
        if (!hydrated) return;
        const searches = await syncDomainSavedSearches(await getSavedSearches());
        if (collection) {
            collection.replaceItems(searches);
            // React re-renders can drop our list while Domain's own entries stay concealed.
            if (!collection.element.isConnected) attach(collection.element);
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
            title: "Saved searches",
        });
        attach(markOwned(collection.element, "saved-search-collection"));
    }, error => context.logger.error("Could not render saved searches", error));
    const attach = (element: HTMLElement): void => {
        const host = findDomainSavedSearchHost();
        const heading = host.querySelector("h1");
        // Our list carries the title, with its tabs beside it; Domain's own heading steps aside.
        if (heading) heading.dataset.edfReplaced = "true";
        if (heading) heading.after(element);
        else host.append(element);
    };

    onBodyMutations(reconcile.schedule, context.signal);
    context.scope.add(onStorageChange("savedSearches", reconcile.schedule));
    context.scope.add(() => {
        if (document.documentElement.dataset.edfExtensionReload === "true") return;
        restoreDomainSavedSearches();
        collection?.element.remove();
    });
    void waitForHydration(context.signal).then(() => {
        hydrated = true;
        reconcile.schedule();
    }, () => undefined);
};

export default mountSavedSearchesPage;
