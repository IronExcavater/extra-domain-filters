import { onBodyMutations } from "../../dom/bodyMutations";
import { markOwned } from "../../dom/ownership";
import { createReplacementSlot } from "../../dom/replacement";
import { waitForElement } from "../../dom/wait";
import { observeUrlChanges, type PageContext } from "../../platform/router";
import { findDomainProfileHosts } from "../../site-dom/profile";
import { getSettings } from "../../state/settings";
import { createSettingsContent } from "./view";

const SETTINGS_QUERY = "extra-domain-filters";
const SETTINGS_VALUE = "settings";
const TAB_SELECTOR = '[data-extra-domain-filters-settings-tab="true"]';

function isSettingsView(url = new URL(window.location.href)): boolean {
    return url.searchParams.get(SETTINGS_QUERY) === SETTINGS_VALUE;
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

function updateTabState(): void {
    const tab = document.querySelector<HTMLElement>(TAB_SELECTOR);
    const button = tab?.querySelector("button");
    const active = isSettingsView();
    if (!tab || !button) return;

    tab.dataset.selected = String(active);
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

export async function mountProfileSettings(context: PageContext): Promise<void> {
    await waitForElement(() => findDomainProfileHosts()?.navigationList, context.signal);
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
            root.append(createSettingsContent(await getSettings(), {
                sectionHeading: "h3",
                titleHeading: "h2",
            }));
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
