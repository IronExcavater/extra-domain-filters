import {
    saveSearch,
    type SavedSearch,
} from "../../domain/searches/savedSearches";
import { extractSharedFilterParams } from "../filters/searchParams";

const NATIVE_ENTRY_SELECTOR =
    '[data-testid="saved-searches__entry"]:not([data-extra-domain-filters-owner="saved-search-entry"])';
const VIEW_LINK_SELECTOR = '[data-testid="saved-searches__view-properties"]';

function readDomainSearch(
    entry: HTMLElement,
    stored: readonly SavedSearch[],
): SavedSearch | undefined {
    const domainId = entry.dataset.savedsearchId;
    const link = entry.querySelector<HTMLAnchorElement>(VIEW_LINK_SELECTOR) ??
        entry.querySelector<HTMLAnchorElement>("a[href]");
    if (!domainId || !link) return undefined;

    const current = stored.find(search => search.domainId === domainId);
    const url = new URL(link.href, window.location.origin);
    const title = entry.dataset.savedsearchTitle ??
        entry.querySelector<HTMLElement>('[data-testid="saved-searches__entry--title"]')
            ?.textContent?.trim() ??
        "Saved search";

    return {
        createdAt: current?.createdAt ?? Date.now(),
        domainId,
        filterParams: extractSharedFilterParams(url.searchParams).toString() ||
            current?.filterParams ||
            "",
        id: current?.id ?? `domain:${domainId}`,
        notificationFrequency: current?.notificationFrequency ?? "weekly",
        title,
        updatedAt: current?.updatedAt ?? Date.now(),
        url: url.href,
    };
}

function hasChanged(current: SavedSearch | undefined, next: SavedSearch): boolean {
    return !current ||
        current.domainId !== next.domainId ||
        current.filterParams !== next.filterParams ||
        current.notificationFrequency !== next.notificationFrequency ||
        current.title !== next.title ||
        current.url !== next.url;
}

export function findDomainSearchHost(): HTMLElement {
    const page = document.querySelector<HTMLElement>("#savedSearches");
    if (page) return page;

    const nativeEntry = document.querySelector<HTMLElement>(NATIVE_ENTRY_SELECTOR);
    return nativeEntry?.parentElement ??
        document.querySelector("main") ??
        document.body;
}

export async function syncDomainSavedSearches(
    stored: readonly SavedSearch[],
): Promise<SavedSearch[]> {
    const searches = [...stored];
    const visibleDomainIds = new Set<string>();

    for (const entry of document.querySelectorAll<HTMLElement>(NATIVE_ENTRY_SELECTOR)) {
        entry.dataset.edfNativeSearchHidden = "true";
        const search = readDomainSearch(entry, stored);
        if (!search) continue;

        if (search.domainId) visibleDomainIds.add(search.domainId);
        const index = searches.findIndex(candidate => candidate.id === search.id);
        if (index === -1) searches.push(search);
        else searches[index] = search;
        if (hasChanged(stored.find(candidate => candidate.id === search.id), search)) {
            await saveSearch({ ...search, id: search.id });
        }
    }

    return searches.filter(search => !search.domainId || visibleDomainIds.has(search.domainId));
}

export async function removeDomainSavedSearch(domainId: string): Promise<void> {
    const entry = document.querySelector<HTMLElement>(
        `[data-savedsearch-id="${CSS.escape(domainId)}"]`,
    );
    const toggle = entry?.querySelector<HTMLButtonElement>('button[aria-label="open menu"]');
    if (!toggle) return;

    toggle.click();
    await new Promise<void>(resolve => {
        requestAnimationFrame(() => requestAnimationFrame(() => resolve()));
    });
    [...document.querySelectorAll<HTMLElement>('[role="option"]')]
        .find(option => option.textContent?.trim() === "Remove search")
        ?.click();
}

export function restoreDomainSavedSearches(): void {
    document.querySelectorAll<HTMLElement>('[data-edf-native-search-hidden="true"]')
        .forEach(entry => entry.removeAttribute("data-edf-native-search-hidden"));
}
