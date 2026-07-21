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

export function overridePageTitle(container: HTMLElement, titleText: string): () => void {
    const title = container.querySelector<HTMLElement>('[data-testid="shortlist__title"], h1, h2');
    if (!title) return () => undefined;

    const originalTitle = title.textContent;
    const originalDocumentTitle = document.title;
    title.textContent = titleText;
    document.title = titleText;

    return () => {
        title.textContent = originalTitle;
        document.title = originalDocumentTitle;
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
    const label = document.createElement("span");
    actions.className = "edf-sort-actions";
    actions.setAttribute("data-testid", getActionsTestId(options.id));
    label.dataset.edfSortLabel = "true";
    label.textContent = "Sort by";
    sort.before(actions);
    actions.append(controls, label, sort);
    return controls;
}

export function restorePageActions(container: HTMLElement, id: string): void {
    const actions = container.querySelector<HTMLElement>(`[data-testid="${getActionsTestId(id)}"]`);
    const sort = actions?.querySelector<HTMLElement>(SORT_SELECTOR);
    if (sort && actions) actions.replaceWith(sort);
    else actions?.remove();
    container.querySelector(`[data-testid="${getControlsTestId(id)}"]`)?.remove();
}
