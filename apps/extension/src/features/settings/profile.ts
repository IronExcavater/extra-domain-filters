import { onBodyMutations } from "../../dom/bodyMutations";
import { isOwnedNode, markOwned } from "../../dom/ownership";
import { createReplacementSlot } from "../../dom/replacement";
import { waitForElement, waitForHydration } from "../../dom/wait";
import { observeUrlChanges, type PageContext } from "../../platform/router";
import { findDomainProfileHosts, SETTINGS_QUERY, SETTINGS_VALUE } from "../../site-dom/profile";
import { getSettings } from "../../state/settings";
import { createFiltersView } from "./filters";
import { createSettingsContent } from "./view";

const TAB_SELECTOR = '[data-extra-domain-filters-settings-tab="true"]';

function isSettingsView(url = new URL(window.location.href)): boolean {
    return url.searchParams.get(SETTINGS_QUERY) === SETTINGS_VALUE;
}

/** Account, General, the Filters cards (as in the popup), Privacy and data, Support. */
async function renderSettings(root: HTMLElement, signal: AbortSignal): Promise<void> {
    const settings = await getSettings();
    const content = createSettingsContent(settings, {
        excludeSections: ["filters"],
        sectionHeading: "h3",
        titleHeading: "h2",
    });
    const filters = createFiltersView({ embedded: true, heading: "h3", settings, signal });
    content.querySelector('[data-section="general"]')?.after(filters);
    root.replaceChildren(content);
}

function createSettingsTab(context: PageContext): HTMLLIElement {
    const item = markOwned(document.createElement("li"), "profile-settings-tab");
    const button = document.createElement("button");

    item.className = "edf-profile-settings-tab";
    item.dataset.extraDomainFiltersSettingsTab = "true";
    button.type = "button";
    button.textContent = "Extension preferences";
    button.addEventListener("click", () => {
        const url = new URL(window.location.href);
        url.searchParams.set(SETTINGS_QUERY, SETTINGS_VALUE);
        history.pushState({}, "", url);
    }, { signal: context.signal });
    item.append(button);
    return item;
}

/**
 * Domain marks its selected item with a class of its own, which it keeps while our page is
 * open; the list's flag lets CSS show that item as unselected (features/account/styles.css).
 */
function updateTabState(): void {
    const tab = document.querySelector<HTMLElement>(TAB_SELECTOR);
    const button = tab?.querySelector("button");
    const active = isSettingsView();
    if (!tab || !button) return;

    tab.dataset.selected = String(active);
    if (tab.parentElement) tab.parentElement.dataset.edfSettingsActive = String(active);
    if (active) button.setAttribute("aria-current", "page");
    else button.removeAttribute("aria-current");
}

function injectSettingsTab(context: PageContext): void {
    const hosts = findDomainProfileHosts();
    if (!hosts || hosts.navigationList.querySelector(TAB_SELECTOR)) {
        updateTabState();
        return;
    }

    const tab = createSettingsTab(context);
    hosts.navigationList.append(tab);
    hosts.navigationList.addEventListener("click", event => {
        const target = event.target;
        if (!(target instanceof Element) || target.closest(TAB_SELECTOR)) return;
        const url = new URL(window.location.href);
        if (!url.searchParams.has(SETTINGS_QUERY)) return;
        url.searchParams.delete(SETTINGS_QUERY);
        history.pushState({}, "", url);
    }, { signal: context.signal });
    updateTabState();
}

/**
 * Signed out there is no profile sidebar to sit in, so the settings take over the page's
 * main content instead, on the same URL.
 */
function mountStandaloneSettings(context: PageContext): void {
    if (!isSettingsView()) return;
    const main = document.querySelector<HTMLElement>("main") ?? document.body;
    const panel = markOwned(document.createElement("div"), "profile-settings");
    const replaced = [...main.children].filter((child): child is HTMLElement =>
        child instanceof HTMLElement && !isOwnedNode(child));

    panel.className = "edf-settings-panel edf-settings-standalone";
    panel.dataset.extraDomainFiltersSettings = "true";
    replaced.forEach(child => { child.dataset.edfReplaced = "true"; });
    main.prepend(panel);
    void renderSettings(panel, context.signal)
        .catch(error => context.logger.warn("Could not render extension preferences", error));
    context.scope.add(() => {
        panel.remove();
        replaced.forEach(child => delete child.dataset.edfReplaced);
    });
}

export async function mountProfileSettings(context: PageContext): Promise<void> {
    await waitForHydration(context.signal);
    const navigation = await waitForElement(() => findDomainProfileHosts()?.navigationList, context.signal, {
        timeoutMs: 6000,
    }).catch(() => undefined);
    if (context.signal.aborted) return;
    if (!navigation) {
        mountStandaloneSettings(context);
        return;
    }
    injectSettingsTab(context);

    const slot = createReplacementSlot(context.scope, {
        mount: (target, root) => {
            root.className = "edf-settings-panel";
            root.dataset.extraDomainFiltersSettings = "true";
            target.native?.after(root);
        },
        onError: error => context.logger.warn("Could not render extension preferences", error),
        owner: "profile-settings",
        render: async root => {
            if (root.childElementCount > 0) return;
            await renderSettings(root, context.signal);
        },
        resolve: () => {
            if (!isSettingsView()) return undefined;
            const hosts = findDomainProfileHosts();
            return hosts
                ? { host: hosts.contentHost, native: hosts.nativeContent }
                : undefined;
        },
    });

    observeUrlChanges(() => {
        injectSettingsTab(context);
        updateTabState();
        slot.schedule();
    }, context.signal);

    onBodyMutations(() => injectSettingsTab(context), context.signal);
}
