import { waitForElement } from "../../shared/dom/wait";

const SHORTLIST_ROOT_SELECTOR = "#shortlist";
const LISTING_CARD_SELECTOR = '[data-testid="listing-card-container"]';
const SORT_SELECTOR = '[data-testid="listing-tabs__filters-sort-by"]';

export function findUserListingsContainer(): HTMLElement | undefined {
    const root = document.querySelector(SHORTLIST_ROOT_SELECTOR);
    return root?.firstElementChild instanceof HTMLElement
        ? root.firstElementChild
        : undefined;
}

export function waitForUserListingsContainer(signal: AbortSignal): Promise<HTMLElement> {
    return waitForElement(findUserListingsContainer, signal);
}

export function getUserListingCards(container: HTMLElement): HTMLElement[] {
    return [...container.querySelectorAll<HTMLElement>(LISTING_CARD_SELECTOR)];
}

export function getUserListingUrl(card: HTMLElement): string | undefined {
    const url = card.querySelector<HTMLAnchorElement>('a[href*="domain.com.au"]')?.href;
    return url ? new URL(url, window.location.origin).href : undefined;
}

export function getUserListingUrls(cards: readonly HTMLElement[]): string[] {
    return cards
        .map(getUserListingUrl)
        .filter((url): url is string => url !== undefined);
}

export function overridePageTitle(
    container: HTMLElement,
    titleText: string,
    documentTitle: string | false = titleText,
): () => void {
    const title = container.querySelector<HTMLElement>('[data-testid="shortlist__title"], h1, h2');
    if (!title) return () => undefined;

    const originalTitle = title.textContent;
    const originalDocumentTitle = document.title;
    title.textContent = titleText;
    if (documentTitle) document.title = documentTitle;

    return () => {
        title.textContent = originalTitle;
        if (documentTitle) document.title = originalDocumentTitle;
    };
}

export interface PageActionsOptions {
    id: string;
    container: HTMLElement;
    fallbackAnchor: HTMLElement;
}

function getControlsTestId(id: string): string {
    return `extra-domain-filters-${id}-controls`;
}

function getActionsTestId(id: string): string {
    return `extra-domain-filters-${id}-sort-actions`;
}

export function getPageActions(options: PageActionsOptions): HTMLDivElement {
    const controlsTestId = getControlsTestId(options.id);
    const existing = options.container.querySelector<HTMLDivElement>(`[data-testid="${controlsTestId}"]`);
    if (existing) return existing;

    const controls = document.createElement("div");
    controls.className = "edf-page-actions";
    controls.setAttribute("data-testid", controlsTestId);

    const sort = options.container.querySelector<HTMLElement>(SORT_SELECTOR);
    if (!sort) {
        options.fallbackAnchor.before(controls);
        return controls;
    }

    const actions = document.createElement("div");
    const selectionGroup = document.createElement("div");
    const filterGroup = document.createElement("div");
    const label = document.createElement("span");
    actions.className = "edf-sort-actions";
    selectionGroup.className = "edf-control-group";
    filterGroup.className = "edf-control-group";
    actions.setAttribute("data-testid", getActionsTestId(options.id));
    label.dataset.edfSortLabel = "true";
    label.textContent = "Sort by";
    sort.before(actions);
    selectionGroup.append(controls);
    filterGroup.append(label, sort);
    actions.append(selectionGroup, filterGroup);
    return controls;
}

export function restorePageActions(container: HTMLElement, id: string): void {
    const actions = container.querySelector<HTMLElement>(`[data-testid="${getActionsTestId(id)}"]`);
    const sort = actions?.querySelector<HTMLElement>(SORT_SELECTOR);
    if (sort && actions) actions.replaceWith(sort);
    else actions?.remove();
    container.querySelector(`[data-testid="${getControlsTestId(id)}"]`)?.remove();
}

type ListingFilter = "all" | "buy" | "rent";

function isListingFilter(value: string): value is ListingFilter {
    return value === "all" || value === "buy" || value === "rent";
}

export function replaceUserListingTabs(
    container: HTMLElement,
    signal: AbortSignal,
    onChange?: (filter: ListingFilter) => void,
    actions?: HTMLElement,
): () => void {
    const native = container.querySelector<HTMLElement>('[role="tablist"]');
    const nativeTabs = [...(native?.querySelectorAll<HTMLButtonElement>('[role="tab"]') ?? [])];
    if (!native || nativeTabs.length === 0) return () => undefined;

    const tabs = document.createElement("div");
    const originalHidden = native.hidden;
    const sync = (): void => {
        const selected = nativeTabs.find(tab => tab.ariaSelected === "true")?.textContent?.trim().toLowerCase();

        tabs.querySelectorAll<HTMLButtonElement>("button").forEach(button => {
            button.ariaSelected = String(button.dataset.filter === selected);
        });
    };

    tabs.className = "edf-collection-tabs edf-listing-tabs";
    tabs.setAttribute("role", "tablist");
    nativeTabs.forEach(nativeTab => {
        const filter = nativeTab.textContent?.trim().toLowerCase();
        if (!filter || !isListingFilter(filter)) return;

        const tab = document.createElement("button");
        tab.className = "edf-collection-tab edf-listing-tab";
        tab.dataset.filter = filter;
        tab.setAttribute("role", "tab");
        tab.textContent = filter;
        tab.addEventListener("click", () => {
            if (onChange) onChange(filter);
            else nativeTab.click();
            sync();
        }, { signal });
        tabs.append(tab);
    });

    const actionsParent = actions?.parentNode;
    const actionsNextSibling = actions?.nextSibling;
    const toolbar = actions
        ? document.createElement("div")
        : undefined;
    if (toolbar && actions) {
        toolbar.className = "edf-listing-page-toolbar";
        native.before(toolbar);
        toolbar.append(tabs, actions);
    } else {
        native.before(tabs);
    }
    native.hidden = true;
    const observer = new MutationObserver(sync);
    observer.observe(native, { attributes: true, childList: true, subtree: true });
    signal.addEventListener("abort", () => {
        observer.disconnect();
        if (actions && actionsParent) {
            if (actionsNextSibling?.parentNode === actionsParent) {
                actionsParent.insertBefore(actions, actionsNextSibling);
            } else {
                actionsParent.append(actions);
            }
        }
        toolbar?.remove();
        tabs.remove();
        native.hidden = originalHidden;
    }, { once: true });
    sync();

    return () => {
        observer.disconnect();
        if (actions && actionsParent) {
            if (actionsNextSibling?.parentNode === actionsParent) {
                actionsParent.insertBefore(actions, actionsNextSibling);
            } else {
                actionsParent.append(actions);
            }
        }
        toolbar?.remove();
        tabs.remove();
        native.hidden = originalHidden;
    };
}
