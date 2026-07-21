import { waitForElement } from "../../shared/dom/wait";
import { copyText } from "../../shared/platform/clipboard";
import type { PageContext } from "../../shared/platform/router";
import { onStorageChange } from "../../shared/platform/storage";
import { getSavedSearchFilters, setSavedSearchFilters } from "../../shared/state/savedSearches";
import { getSettings } from "../../shared/state/settings";
import { cloneActionButton } from "../filters/clone/action";
import { createSharedFilterUrl } from "../filters/searchParams";

const SAVED_SEARCH_ENTRY_SELECTOR = '[data-testid="saved-searches__entry"]';
const VIEW_PROPERTIES_SELECTOR = '[data-testid="saved-searches__view-properties"]';
const SAVED_SEARCH_CONTEXT_PARAM = "edf-saved-search";

function getSavedSearchId(entry: HTMLElement): string | undefined {
    return entry.dataset.savedsearchId;
}

function getSearchLinks(entry: HTMLElement): HTMLAnchorElement[] {
    return [...entry.querySelectorAll<HTMLAnchorElement>("a[href]")]
        .filter(link => link.href.includes("domain.com.au"));
}

function rememberHref(link: HTMLAnchorElement): string {
    if (!link.dataset.extraDomainFiltersOriginalHref) {
        link.dataset.extraDomainFiltersOriginalHref = link.href;
    }
    return link.dataset.extraDomainFiltersOriginalHref;
}

function cloneSavedSearchAction(source: HTMLAnchorElement, label: string): HTMLAnchorElement {
    const action = source.cloneNode(true) as HTMLAnchorElement;
    action.textContent = label;
    action.removeAttribute("data-testid");
    action.classList.add("edf-saved-search-action");
    return action;
}

async function updateEntry(entry: HTMLElement): Promise<void> {
    const savedSearchId = getSavedSearchId(entry);
    const source = entry.querySelector<HTMLAnchorElement>(VIEW_PROPERTIES_SELECTOR);
    if (!savedSearchId || !source) return;

    const metadata = await getSavedSearchFilters(savedSearchId);
    const baseUrl = new URL(rememberHref(source));
    const searchUrl = metadata
        ? createSharedFilterUrl({ filters: metadata.filters }, baseUrl)
        : baseUrl;

    for (const link of getSearchLinks(entry)) {
        const original = new URL(rememberHref(link));
        link.href = metadata
            ? createSharedFilterUrl({ filters: metadata.filters }, original).href
            : original.href;
    }

    entry.querySelectorAll('[data-extra-domain-filters-saved-search-action]').forEach(element => element.remove());

    const edit = cloneSavedSearchAction(source, metadata ? "Edit filters" : "Add filters");
    edit.dataset.extraDomainFiltersSavedSearchAction = "edit";
    const editUrl = new URL(searchUrl);
    editUrl.searchParams.set(SAVED_SEARCH_CONTEXT_PARAM, savedSearchId);
    edit.href = editUrl.href;

    const share = cloneSavedSearchAction(source, "Share");
    share.dataset.extraDomainFiltersSavedSearchAction = "share";
    share.href = searchUrl.href;
    share.addEventListener("click", async event => {
        event.preventDefault();
        await copyText(searchUrl.href);
        share.textContent = "Copied";
        share.blur();
        window.setTimeout(() => { share.textContent = "Share"; }, 1400);
    });
    source.after(edit, share);
}

async function updateEntries(): Promise<void> {
    await Promise.all([...document.querySelectorAll<HTMLElement>(SAVED_SEARCH_ENTRY_SELECTOR)].map(updateEntry));
}

export function bindSavedSearchEntries(context: PageContext): void {
    let frame: number | undefined;
    const schedule = (): void => {
        if (frame !== undefined) return;
        frame = requestAnimationFrame(() => {
            frame = undefined;
            void updateEntries();
        });
    };
    const observer = new MutationObserver(mutations => {
        if (mutations.some(mutation => [...mutation.addedNodes].some(node =>
            node instanceof HTMLElement &&
            !node.hasAttribute("data-extra-domain-filters-saved-search-action") &&
            (node.matches(SAVED_SEARCH_ENTRY_SELECTOR) || Boolean(node.querySelector(SAVED_SEARCH_ENTRY_SELECTOR)))
        ))) schedule();
    });
    const unwatchMetadata = onStorageChange("saved-search-filters", schedule);

    observer.observe(document.body, { childList: true, subtree: true });
    context.signal.addEventListener("abort", () => {
        observer.disconnect();
        unwatchMetadata();
        if (frame !== undefined) cancelAnimationFrame(frame);
    }, { once: true });
    schedule();
}

export function bindSavedSearchFilterSave(context: PageContext): void {
    const savedSearchId = context.url.searchParams.get(SAVED_SEARCH_CONTEXT_PARAM);
    if (!savedSearchId) return;

    void waitForElement(
        () => document.querySelector<HTMLButtonElement>('button[name="property-alert"]') ?? undefined,
        context.signal,
    ).then(source => {
        if (source.parentElement?.querySelector('[data-extra-domain-filters-save-search]')) return;

        const button = cloneActionButton(source, { label: "Save to search" });
        button.dataset.extraDomainFiltersSaveSearch = "true";
        button.ariaLabel = "Save custom filters to this Domain search";
        button.addEventListener("click", async event => {
            event.preventDefault();
            button.disabled = true;
            await setSavedSearchFilters(savedSearchId, (await getSettings()).filters);
            const url = new URL(window.location.href);
            url.searchParams.delete(SAVED_SEARCH_CONTEXT_PARAM);
            history.replaceState({}, "", url);
            button.textContent = "Saved";
            button.blur();
        });
        source.after(button);
    }).catch(error => {
        if (error instanceof DOMException && error.name === "AbortError") return;
        context.logger.error("Unable to bind saved-search filter save", error);
    });
}
