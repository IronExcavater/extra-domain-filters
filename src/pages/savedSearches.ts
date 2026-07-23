import {
    getSavedSearches,
    removeSavedSearch,
    saveSearch,
    type SavedSearch,
} from "../domain/searches/savedSearches";
import { enableStickyHeader } from "../features/navigation";
import { createSavedSearchCard } from "../features/saved-searches/card";
import {
    findDomainSearchHost,
    removeDomainSavedSearch,
    restoreDomainSavedSearches,
    syncDomainSavedSearches,
} from "../features/saved-searches/domainAdapter";
import {
    sortSavedSearches,
    getSavedSearchType,
    type SavedSearchSort,
    type SavedSearchType,
} from "../features/saved-searches/sort";
import { isOwnedNode, markOwned } from "../shared/dom/ownership";
import { createFrameReconciler } from "../shared/dom/reconcile";
import type { PageMount } from "../shared/platform/router";
import { onStorageChange } from "../shared/platform/storage";
import {
    renderSelectionControls,
    replaceSelection,
    setSelectionCheckboxState,
} from "../shared/ui/selection";
import { createSortControl, type SortControl } from "../shared/ui/sort";
import { createTabs } from "../shared/ui/tabs";
import { showToast } from "../shared/ui/toast";

const selectedSearchIds = new Set<string>();


function getOrCreateList(): HTMLElement {
    const existing = document.querySelector<HTMLElement>(
        '[data-testid="extra-domain-filters-saved-search-list"]',
    );
    if (existing) return existing;

    const list = document.createElement("div");

    list.className = "edf-saved-search-list";
    list.dataset.testid = "extra-domain-filters-saved-search-list";
    findDomainSearchHost().append(markOwned(list, "saved-search-list"));

    return list;
}

async function removeSearch(search: SavedSearch): Promise<void> {
    if (search.domainId) await removeDomainSavedSearch(search.domainId);
    await removeSavedSearch(search.id);
    selectedSearchIds.delete(search.id);
}

async function removeSelected(
    ids: readonly string[],
    searches: readonly SavedSearch[],
): Promise<void> {
    const selected = new Set(ids);

    for (const search of searches.filter(candidate => selected.has(candidate.id))) {
        await removeSearch(search);
    }
    showToast(ids.length === 1 ? "Saved search deleted" : "Saved searches deleted");
}

function renderCards(
    list: HTMLElement,
    searches: readonly SavedSearch[],
    sort: SavedSearchSort,
    signal: AbortSignal,
    onSelectionChange: () => void,
): void {
    const sorted = sortSavedSearches(searches, sort);
    const signature = JSON.stringify({
        searches: sorted.map(search => [
            search.id,
            search.updatedAt,
            search.notificationFrequency,
            search.filterParams,
        ]),
    });
    if (list.dataset.edfSignature === signature) return;

    list.dataset.edfSignature = signature;
    list.replaceChildren(...sorted.map(search => createSavedSearchCard(search, {
        onRemove: removeSearch,
        onSave: async next => {
            await saveSearch({ ...next, id: next.id });
        },
        onSelectionChange: selected => {
            if (selected) selectedSearchIds.add(search.id);
            else selectedSearchIds.delete(search.id);
            onSelectionChange();
        },
        selected: selectedSearchIds.has(search.id),
        signal,
    })));
}

function syncSelectionCheckboxes(list: HTMLElement): void {
    for (const card of list.querySelectorAll<HTMLElement>("[data-savedsearch-id]")) {
        const checkbox = card.querySelector<HTMLInputElement>(".edf-selection-checkbox input");
        if (checkbox) setSelectionCheckboxState(checkbox, selectedSearchIds.has(card.dataset.savedsearchId ?? ""));
    }
}

const mountSavedSearchesPage: PageMount = context => {
    enableStickyHeader(context);
    let currentSearches: readonly SavedSearch[] = [];
    let list: HTMLElement | undefined;
    let controls: HTMLElement | undefined;
    let toolbar: HTMLElement | undefined;
    let tabs: HTMLElement | undefined;
    let sortControl: SortControl | undefined;
    let sort: SavedSearchSort = "newest";
    let searchType: SavedSearchType = "all";

    const visibleSearches = (): readonly SavedSearch[] => currentSearches.filter(search =>
        searchType === "all" || getSavedSearchType(search) === searchType,
    );

    const renderControls = (): void => {
        if (!controls) return;
        renderSelectionControls({
            buttonClassName: "edf-selection-action",
            clearLabel: "Remove selected",
            controls,
            onClear: ids => void removeSelected(ids, currentSearches),
            onSelectionChange: ids => {
                replaceSelection(selectedSearchIds, ids);
                if (list) syncSelectionCheckboxes(list);
                renderControls();
            },
            selectedIds: [...selectedSearchIds],
            visibleIds: visibleSearches().map(search => search.id),
        });
    };

    const ensureToolbar = (): void => {
        if (toolbar) return;
        const page = document.querySelector<HTMLElement>("#savedSearches");
        const heading = page?.querySelector("h1");
        if (!heading) return;

        toolbar = document.createElement("div");
        controls = document.createElement("div");
        const actions = document.createElement("div");
        toolbar.className = "edf-saved-search-page-toolbar";
        controls.className = "edf-page-actions";
        actions.className = "edf-sort-actions";
        tabs = createTabs<SavedSearchType>({
            active: searchType,
            onChange: type => {
                searchType = type;
                if (list) list.dataset.edfSignature = "";
                reconcile.schedule();
            },
            options: [
                { label: "All", value: "all" },
                { label: "Buy", value: "buy" },
                { label: "Rent", value: "rent" },
            ],
            signal: context.signal,
        });
        sortControl = createSortControl({
            ariaLabel: "Sort saved searches",
            onChange: () => {
                sort = sortControl?.value() as SavedSearchSort;
                if (list) list.dataset.edfSignature = "";
                reconcile.schedule();
            },
            options: [
                ["newest", "Newest"],
                ["oldest", "Oldest"],
                ["title", "Title"],
            ],
            signal: context.signal,
        });
        actions.append(controls, sortControl.element);
        toolbar.append(tabs, actions);
        heading.after(markOwned(toolbar, "saved-search-controls"));
    };

    const reconcile = createFrameReconciler(context.scope, async () => {
        currentSearches = await syncDomainSavedSearches(await getSavedSearches());
        list ??= getOrCreateList();
        ensureToolbar();
        renderCards(list, visibleSearches(), sort, context.signal, () => {
            renderControls();
        });
        renderControls();
    }, error => context.logger.error("Could not render saved searches", error));

    const observer = new MutationObserver(mutations => {
        if (mutations.some(mutation =>
            [...mutation.addedNodes, ...mutation.removedNodes].some(node => !isOwnedNode(node))
        )) {
            reconcile.schedule();
        }
    });
    observer.observe(document.body, { childList: true, subtree: true });
    context.scope.add(() => observer.disconnect());
    context.scope.add(onStorageChange("savedSearches", reconcile.schedule));
    context.scope.add(restoreDomainSavedSearches);
    reconcile.schedule();
};

export default mountSavedSearchesPage;
