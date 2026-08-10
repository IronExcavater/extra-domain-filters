import { saveSearch, type SavedSearch } from "../../domain/searches/savedSearches";
import { extractSharedFilterParams } from "../../features/filters/searchParams";

export interface DomainSavedSearchRemoveMessage {
    domainId: string;
    type: "edf:domain-saved-search:remove";
}

export function isDomainSavedSearchRemoveMessage(value: unknown): value is DomainSavedSearchRemoveMessage {
    if (!value || typeof value !== "object") return false;
    const candidate = value as Partial<DomainSavedSearchRemoveMessage>;
    return candidate.type === "edf:domain-saved-search:remove"
        && typeof candidate.domainId === "string";
}

const NATIVE_ENTRY_SELECTOR =
    '[data-testid="saved-searches__entry"]:not([data-extra-domain-filters-owner="saved-search-entry"])';

function readNewListingCount(entry: HTMLElement): number | undefined {
    const match = entry.textContent?.match(/\b(\d[\d,]*)\s+new\b/i);
    if (!match) return undefined;
    const count = Number(match[1].replaceAll(",", ""));
    return Number.isSafeInteger(count) && count >= 0 ? count : undefined;
}

export function readDomainSavedSearches(stored: readonly SavedSearch[]): SavedSearch[] {
    return [...document.querySelectorAll<HTMLElement>(NATIVE_ENTRY_SELECTOR)]
        .map((entry): SavedSearch | undefined => {
            const domainId = entry.dataset.savedsearchId;
            const link = entry.querySelector<HTMLAnchorElement>("a[href]");
            if (!domainId || !link) return undefined;
            const current = stored.find(search => search.domainId === domainId);
            const url = new URL(link.href, window.location.origin);
            const title = entry.dataset.savedsearchTitle
                ?? entry.querySelector<HTMLElement>('[data-testid="saved-searches__entry--title"]')?.textContent?.trim()
                ?? "Saved search";
            return {
                createdAt: current?.createdAt ?? Date.now(),
                domainId,
                filterParams: extractSharedFilterParams(url.searchParams).toString() || current?.filterParams || "",
                id: current?.id ?? `domain:${domainId}`,
                newListingCount: readNewListingCount(entry),
                notificationFrequency: current?.notificationFrequency ?? "weekly",
                title,
                updatedAt: current?.updatedAt ?? Date.now(),
                url: url.href,
            };
        })
        .filter((search): search is SavedSearch => search !== undefined);
}

export function findDomainSavedSearchHost(): HTMLElement {
    return document.querySelector<HTMLElement>("#savedSearches")
        ?? document.querySelector<HTMLElement>(NATIVE_ENTRY_SELECTOR)?.parentElement
        ?? document.querySelector("main")
        ?? document.body;
}

export function findDomainSavedSearchAlertTrigger(domainId: string): HTMLButtonElement | undefined {
    const entry = findDomainSavedSearchEntry(domainId);
    return entry?.querySelector<HTMLButtonElement>(
        'button[name="property-alert"], button[aria-label*="alert" i], [data-testid*="notification"] button',
    ) ?? undefined;
}

export function findDomainSavedSearchEntry(domainId: string): HTMLElement | undefined {
    return document.querySelector<HTMLElement>(
        `[data-savedsearch-id="${CSS.escape(domainId)}"]:not([data-extra-domain-filters-owner])`,
    ) ?? undefined;
}

export function concealDomainSavedSearches(): void {
    document.querySelectorAll<HTMLElement>(NATIVE_ENTRY_SELECTOR).forEach(entry => {
        entry.dataset.edfNativeSearchHidden = "true";
    });
}

function hasChanged(current: SavedSearch | undefined, next: SavedSearch): boolean {
    return !current
        || current.domainId !== next.domainId
        || current.filterParams !== next.filterParams
        || current.newListingCount !== next.newListingCount
        || current.notificationFrequency !== next.notificationFrequency
        || current.title !== next.title
        || current.url !== next.url;
}

export async function syncDomainSavedSearches(stored: readonly SavedSearch[]): Promise<SavedSearch[]> {
    concealDomainSavedSearches();
    const native = readDomainSavedSearches(stored);
    const visibleDomainIds = new Set(native.map(search => search.domainId));
    const searches = stored.filter(search => !search.domainId || visibleDomainIds.has(search.domainId));
    for (const search of native) {
        const index = searches.findIndex(candidate => candidate.id === search.id);
        if (index === -1) searches.push(search);
        else searches[index] = search;
        if (hasChanged(stored.find(candidate => candidate.id === search.id), search)) {
            await saveSearch({ ...search, id: search.id });
        }
    }
    return searches;
}

export function restoreDomainSavedSearches(): void {
    document.querySelectorAll<HTMLElement>('[data-edf-native-search-hidden="true"]')
        .forEach(entry => entry.removeAttribute("data-edf-native-search-hidden"));
}

export async function removeDomainSavedSearch(domainId: string): Promise<void> {
    const entry = findDomainSavedSearchEntry(domainId);
    const toggle = entry?.querySelector<HTMLButtonElement>('button[aria-label*="menu" i], button[aria-haspopup="menu"]');
    if (!toggle) throw new Error("Domain's saved-search menu is unavailable.");
    toggle.click();
    await new Promise<void>(resolve => requestAnimationFrame(() => requestAnimationFrame(() => resolve())));
    const remove = [...document.querySelectorAll<HTMLElement>('[role="option"], [role="menuitem"]')]
        .find(option => /^remove search$/i.test(option.textContent?.trim() ?? ""));
    if (!remove) throw new Error("Domain's remove-search action is unavailable.");
    remove.click();
}
