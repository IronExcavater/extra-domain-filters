import { onBodyMutations } from "../../dom/bodyMutations";
import { markOwned } from "../../dom/ownership";
import { waitForElement } from "../../dom/wait";
import { createSortControl } from "../../ui/sort";
import { attachTabIndicator } from "../../ui/tabs";

const SHORTLIST_ROOT_SELECTOR = "#shortlist";
export const LISTING_CARD_SELECTOR = '[data-testid="listing-card-container"]';
export const SORT_SELECTOR = '[data-testid="listing-tabs__filters-sort-by"]';

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

const MESSAGE_WRAPPER_SELECTOR = '[data-testid="shortlist__message_wrapper"]';
const SUBTITLE_TEST_ID = "extra-domain-filters-listings-subtitle";
export const SHORTLIST_SUBTITLE =
    "Want to Shortlist with someone? Download the Domain app to Shortlist Together.";

/**
 * An owned subtitle under the page title. Domain only renders its shortlist message on some
 * tabs and drops it on re-render, so the page shows its own copy for its whole lifetime (and
 * the blacklist page shows text that is actually about the blacklist).
 */
export function setListingsSubtitle(container: HTMLElement, text: string): void {
    const title = container.querySelector<HTMLElement>('[data-testid="shortlist__title"], h1, h2');
    if (!title) return;

    const nativeMessage = container.querySelector<HTMLElement>(MESSAGE_WRAPPER_SELECTOR);
    if (nativeMessage) nativeMessage.hidden = true;

    const existing = container.querySelector<HTMLElement>(`[data-testid="${SUBTITLE_TEST_ID}"]`);
    const subtitle = existing ?? markOwned(document.createElement("p"), "listings-subtitle");
    subtitle.className = "edf-relocated-shortlist-message";
    subtitle.dataset.testid = SUBTITLE_TEST_ID;
    if (subtitle.textContent !== text) subtitle.textContent = text;
    if (title.nextElementSibling !== subtitle) title.after(subtitle);
}

export type ListingsInstall = (container: HTMLElement, signal: AbortSignal) => Promise<() => void> | (() => void);

/**
 * Mounts a shortlist/blacklist page into Domain's listings container and re-mounts whenever
 * that container is replaced. The content script starts before Domain renders (and then
 * hydrates) the page, so a one-off lookup either finds nothing or a node that is about to go.
 */
export async function keepListingsPageMounted(
    signal: AbortSignal,
    install: ListingsInstall,
): Promise<void> {
    let current: { container: HTMLElement; controller: AbortController; teardown: () => void } | undefined;
    let pending: Promise<void> | undefined;

    const mount = async (): Promise<void> => {
        const container = await waitForUserListingsContainer(signal);
        if (current?.container === container) return;
        current?.controller.abort();
        current?.teardown();
        const controller = new AbortController();
        signal.addEventListener("abort", () => controller.abort(), { once: true });
        current = { container, controller, teardown: () => undefined };
        const teardown = await install(container, controller.signal);
        if (current?.controller === controller) current.teardown = teardown;
        else teardown();
    };
    const remount = (): void => {
        pending ??= mount().finally(() => {
            pending = undefined;
        });
    };

    remount();
    await pending;
    onBodyMutations(() => {
        if (current && !current.container.isConnected) remount();
    }, signal);
    signal.addEventListener("abort", () => {
        current?.controller.abort();
        current?.teardown();
    }, { once: true });
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

    const controls = markOwned(document.createElement("div"), "page-actions");
    controls.className = "edf-page-actions";
    controls.setAttribute("data-testid", controlsTestId);

    const sort = options.container.querySelector<HTMLElement>(SORT_SELECTOR);
    if (!sort) {
        options.fallbackAnchor.before(controls);
        return controls;
    }

    const actions = markOwned(document.createElement("div"), "sort-actions");
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

    const tabs = markOwned(document.createElement("div"), "listing-tabs");
    const originalHidden = native.hidden;
    const readNative = (): string | undefined =>
        nativeTabs.find(tab => tab.ariaSelected === "true")?.textContent?.trim().toLowerCase();
    // With `onChange` (blacklist page) the hidden native tabs never change, so the selection
    // is ours; otherwise Domain's tabs drive it (shortlist page).
    let selected = readNative() ?? "all";
    const sync = (): void => {
        if (!onChange) selected = readNative() ?? selected;
        tabs.querySelectorAll<HTMLButtonElement>("button").forEach(button => {
            const next = String(button.dataset.filter === selected);
            if (button.ariaSelected !== next) button.ariaSelected = next;
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
            selected = filter;
            if (onChange) onChange(filter);
            else nativeTab.click();
            sync();
        }, { signal });
        tabs.append(tab);
    });

    const actionsParent = actions?.parentNode;
    const actionsNextSibling = actions?.nextSibling;
    const toolbar = actions
        ? markOwned(document.createElement("div"), "listing-toolbar")
        : undefined;
    if (toolbar && actions) {
        toolbar.className = "edf-listing-page-toolbar";
        native.before(toolbar);
        toolbar.append(tabs, actions);
    } else {
        native.before(tabs);
    }
    native.hidden = true;
    attachTabIndicator(tabs, "user-listing-tabs", signal);
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

export interface SortControlOptions<TValue extends string> {
    actionsTestId: string;
    ariaLabel: string;
    onChange: (value: TValue, nativeSort: HTMLElement | undefined) => void;
    options: ReadonlyArray<readonly [TValue, string]>;
    signal: AbortSignal;
}

export function installSortControl<TValue extends string>(
    container: HTMLElement,
    options: SortControlOptions<TValue>,
): () => void {
    const nativeSort = container.querySelector<HTMLElement>(SORT_SELECTOR);
    const actions = container.querySelector<HTMLElement>(`[data-testid="${options.actionsTestId}"]`);
    const filterGroup = actions?.querySelector<HTMLElement>(".edf-control-group:last-child");
    const nativeLabel = actions?.querySelector<HTMLElement>('[data-edf-sort-label="true"]');
    if (!filterGroup) return () => undefined;

    const sort = createSortControl({
        ariaLabel: options.ariaLabel,
        onChange: () => options.onChange(sort.value() as TValue, nativeSort ?? undefined),
        options: options.options,
        signal: options.signal,
    });

    if (nativeSort) nativeSort.hidden = true;
    if (nativeLabel) nativeLabel.hidden = true;
    filterGroup.append(markOwned(sort.element, "sort-control"));

    return () => {
        if (nativeSort) nativeSort.hidden = false;
        if (nativeLabel) nativeLabel.hidden = false;
        sort.element.remove();
    };
}
