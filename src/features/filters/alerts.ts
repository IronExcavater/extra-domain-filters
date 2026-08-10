import {
    getSavedSearches,
    removeSavedSearch,
    saveSearch,
    type SavedSearch,
    type SearchNotificationFrequency,
} from "../../domain/searches/savedSearches";
import { onBodyMutations } from "../../shared/dom/bodyMutations";
import { domainAlertBridge } from "../../shared/domain/alerts";
import { removeDomainSavedSearch } from "../../shared/domain/savedSearches";
import type { PageContext } from "../../shared/platform/router";
import { onStorageChange } from "../../shared/platform/storage";
import { showToast } from "../../shared/ui/toast";
import { openSavedSearchAlertPopover } from "../saved-searches/alertPopover";
import { extractSharedFilterParams } from "./searchParams";

const PAGE_NUMBER_PARAMS = ["page", "pageNumber"];
const boundButtons = new WeakMap<HTMLButtonElement, AbortSignal>();
const boundSignals = new WeakSet<AbortSignal>();

export interface PropertyAlertSearchContext {
    title: string;
    url: string;
}

let propertyAlertSearchContext: PropertyAlertSearchContext | undefined;

export function setPropertyAlertSearchContext(context: PropertyAlertSearchContext): void {
    propertyAlertSearchContext = context;
}

function normalizeSearchUrl(value: string): string {
    const url = new URL(value, window.location.origin);
    PAGE_NUMBER_PARAMS.forEach(key => url.searchParams.delete(key));
    url.searchParams.delete("lastsearchdate");
    url.hash = "";
    url.searchParams.sort();
    return url.href;
}

function isCurrentSearch(search: SavedSearch, url: string): boolean {
    return normalizeSearchUrl(search.url) === normalizeSearchUrl(url);
}

async function getCurrentSearch(url: string): Promise<SavedSearch | undefined> {
    return (await getSavedSearches()).find(search => isCurrentSearch(search, url));
}

function getButtonContext(button: HTMLButtonElement): PropertyAlertSearchContext {
    const card = button.closest<HTMLElement>("article");
    const cardLink = card?.querySelector<HTMLAnchorElement>("a[href]");
    const cardTitle = card?.querySelector<HTMLElement>("h2, h3, [data-testid*='title']")?.textContent?.trim();
    return {
        title: button.dataset.edfAlertSearchTitle
            ?? cardTitle
            ?? propertyAlertSearchContext?.title
            ?? document.title.replace(/\s*\|\s*Domain$/, "")
            ?? "Saved search",
        url: button.dataset.edfAlertSearchUrl
            ?? cardLink?.href
            ?? propertyAlertSearchContext?.url
            ?? window.location.href,
    };
}

function readNativeActive(button: HTMLButtonElement): boolean {
    if (button.dataset.edfNativeAlertSelected) return button.dataset.edfNativeAlertSelected === "true";
    const active = button.dataset.selected === "true"
        || /(?:change|edit).*(?:property )?alert/i.test(`${button.textContent} ${button.ariaLabel}`);
    button.dataset.edfNativeAlertSelected = String(active);
    return active;
}

function setButtonText(button: HTMLButtonElement, value: string): void {
    const label = [...button.querySelectorAll<HTMLElement>("span")].find(span => !span.querySelector("svg"));
    if (label) label.textContent = value;
    else button.textContent = value;
}

function createDraftSearch(
    context: PropertyAlertSearchContext,
    current?: SavedSearch,
): SavedSearch {
    const url = new URL(context.url, window.location.origin);
    const now = Date.now();
    return current ?? {
        createdAt: now,
        filterParams: extractSharedFilterParams(url.searchParams).toString(),
        id: `alert:${normalizeSearchUrl(url.href)}`,
        notificationFrequency: "weekly",
        title: context.title,
        updatedAt: now,
        url: url.href,
    };
}

async function applyNativeFrequency(
    trigger: HTMLButtonElement,
    frequency: SearchNotificationFrequency,
    signal: AbortSignal,
): Promise<void> {
    const result = await domainAlertBridge.apply({ frequency, signal, trigger });
    if (!result.ok) throw new Error(result.message);
}

async function saveAlert(
    trigger: HTMLButtonElement,
    context: PropertyAlertSearchContext,
    current: SavedSearch | undefined,
    frequency: SearchNotificationFrequency,
    signal: AbortSignal,
): Promise<void> {
    const nativeActive = readNativeActive(trigger);
    if (frequency !== "none" || nativeActive) {
        await applyNativeFrequency(trigger, frequency, signal);
    }
    const url = new URL(context.url, window.location.origin);
    await saveSearch({
        domainId: current?.domainId,
        filterParams: extractSharedFilterParams(url.searchParams).toString(),
        id: current?.id,
        newListingCount: current?.newListingCount,
        notificationFrequency: frequency,
        title: context.title,
        url: url.href,
    });
    trigger.dataset.edfNativeAlertSelected = String(frequency !== "none");
    await updatePropertyAlertButtons();
    showToast(frequency === "none" ? "Email alerts disabled" : "Property alert updated");
}

async function deleteAlert(
    trigger: HTMLButtonElement,
    current: SavedSearch | undefined,
    signal: AbortSignal,
): Promise<void> {
    if (current?.domainId) await removeDomainSavedSearch(current.domainId);
    else if (readNativeActive(trigger)) await applyNativeFrequency(trigger, "none", signal);
    if (current) await removeSavedSearch(current.id);
    trigger.dataset.edfNativeAlertSelected = "false";
    await updatePropertyAlertButtons();
    showToast("Saved search deleted");
}

async function openAlertEditor(button: HTMLButtonElement, signal: AbortSignal): Promise<void> {
    const searchContext = getButtonContext(button);
    const current = await getCurrentSearch(searchContext.url);
    const editing = Boolean(current || readNativeActive(button));
    await openSavedSearchAlertPopover({
        anchor: button,
        mode: editing ? "edit" : "create",
        onDelete: editing ? () => deleteAlert(button, current, signal) : undefined,
        onSave: frequency => saveAlert(button, searchContext, current, frequency, signal),
        search: createDraftSearch(searchContext, current),
        signal,
    });
}

function bindButton(button: HTMLButtonElement, context: PageContext): void {
    const existing = boundButtons.get(button);
    if (existing && !existing.aborted) return;
    boundButtons.set(button, context.signal);
    button.classList.add("edf-property-alert-trigger");
    button.addEventListener("click", event => {
        if (button.dataset.edfNativeAlertBridge === "true") return;
        event.preventDefault();
        event.stopPropagation();
        event.stopImmediatePropagation();
        void openAlertEditor(button, context.signal).catch(error => {
            context.logger.warn("Could not open property alert editor", error);
            showToast(error instanceof Error ? error.message : "Could not open property alert editor");
        });
    }, { capture: true, signal: context.signal });
    context.scope.add(() => {
        if (boundButtons.get(button) === context.signal) boundButtons.delete(button);
        button.classList.remove("edf-property-alert-trigger");
    });
}

function findAlertButtons(): HTMLButtonElement[] {
    return [...document.querySelectorAll<HTMLButtonElement>(
        'button[name="property-alert"], [data-testid="create-alert-frequency-button"], #changeAlertFrequencyButton',
    )];
}

export async function updatePropertyAlertButtons(): Promise<void> {
    const searches = await getSavedSearches();
    for (const button of findAlertButtons()) {
        const context = getButtonContext(button);
        const extensionActive = searches.some(search => isCurrentSearch(search, context.url));
        const active = extensionActive || readNativeActive(button);
        button.dataset.edfExtensionAlertActive = String(extensionActive);
        button.dataset.edfAlertActive = String(active);
        setButtonText(button, active ? "Edit alert" : "Create alert");
        button.ariaLabel = active ? "Edit alert" : "Create alert";
    }
}

export function bindPropertyAlertControls(context: PageContext): void {
    if (boundSignals.has(context.signal)) return;
    boundSignals.add(context.signal);
    const reconcile = (): void => {
        findAlertButtons().forEach(button => bindButton(button, context));
        void updatePropertyAlertButtons().catch(error =>
            context.logger.warn("Failed to update property alert state", error));
    };
    reconcile();
    onBodyMutations(reconcile, context.signal);
    context.scope.add(onStorageChange("savedSearches", reconcile));
}

export const bindPropertyAlertModal = bindPropertyAlertControls;
