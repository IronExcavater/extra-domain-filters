import { onBodyMutations } from "../../shared/dom/bodyMutations";
import { markOwned } from "../../shared/dom/ownership";
import { findDomainAccountMenuHosts, type DomainAccountMenuHost } from "../../shared/domain/profile";
import { Logger } from "../../shared/platform/logging";
import { observeUrlChanges, PageContext } from "../../shared/platform/router";
import { getFromStorage, onStorageChange } from "../../shared/platform/storage";
import { createSvgIcon } from "../../shared/ui/elements";
import { replaceWithBinIcon } from "../../shared/ui/icons";

const ITEM_SELECTOR = '[data-testid="account-menu__blacklist-item"]';
const subscriptions = new Map<HTMLElement, () => void>();

function getActiveCount(entries: readonly unknown[] | undefined): number {
    return (entries ?? []).filter(entry =>
        typeof entry !== "object" ||
        entry === null ||
        !("removedAt" in entry) ||
        !(entry as { removedAt?: unknown }).removedAt
    ).length;
}

function bindBadge(item: HTMLElement, badge: HTMLElement, signal?: AbortSignal): void {
    const render = (entries: readonly unknown[] | undefined): void => {
        const count = getActiveCount(entries);
        badge.textContent = String(count);
        badge.hidden = count === 0;
    };
    const dispose = onStorageChange<unknown[]>("blacklist", render);
    subscriptions.set(item, dispose);
    void getFromStorage<unknown[]>("blacklist").then(render);
    signal?.addEventListener("abort", dispose, { once: true });
}

function createAccountMenuItem(
    host: DomainAccountMenuHost,
    active: boolean,
    signal?: AbortSignal,
): HTMLLIElement {
    const item = markOwned(document.createElement("li"), "account-menu-item");
    const link = document.createElement("a");
    const label = document.createElement("span");
    const badge = document.createElement("span");
    const url = new URL(host.shortlistLink.href);

    url.searchParams.set("blacklist", "1");
    item.className = "edf-account-menu-item";
    item.dataset.testid = "account-menu__blacklist-item";
    item.dataset.edfAccountMenuState = active ? "active" : "inactive";
    link.href = url.href;
    link.dataset.menuItemName = "Blacklist";
    if (active) link.setAttribute("aria-current", "page");
    label.className = "edf-account-menu-label";
    label.textContent = "Blacklist";
    badge.className = "edf-account-menu-badge";
    badge.dataset.testid = "account-menu__blacklist-count";
    link.append(createSvgIcon(replaceWithBinIcon, "edf-account-menu-icon"), label, badge);
    item.append(link);
    bindBadge(item, badge, signal);
    return item;
}

function disposeDetachedItems(): void {
    for (const [item, dispose] of subscriptions) {
        if (item.isConnected) continue;
        dispose();
        subscriptions.delete(item);
    }
}

export function injectAccountMenu(logger: Logger, signal?: AbortSignal): void {
    disposeDetachedItems();
    const active = new URL(window.location.href).searchParams.get("blacklist") === "1";

    for (const host of findDomainAccountMenuHosts()) {
        const existingItems = [...host.list.querySelectorAll<HTMLLIElement>(ITEM_SELECTOR)];
        const existing = existingItems.shift();
        existingItems.forEach(item => item.remove());
        const item = existing ?? createAccountMenuItem(host, active, signal);
        const link = item.querySelector<HTMLAnchorElement>("a");

        item.dataset.edfAccountMenuState = active ? "active" : "inactive";
        if (link) {
            if (active) link.setAttribute("aria-current", "page");
            else link.removeAttribute("aria-current");
        }
        if (!existing) logger.info("Injecting account blacklist menu item");
        if (item.previousElementSibling !== host.shortlistItem) host.shortlistItem.after(item);
    }
}

export function bindAccountMenuTrigger(context: PageContext): void {
    let frame: number | undefined;
    const schedule = (): void => {
        if (frame !== undefined) return;
        frame = requestAnimationFrame(() => {
            frame = undefined;
            injectAccountMenu(context.logger, context.signal);
        });
    };

    document.addEventListener("click", event => {
        if (event.target instanceof Element && event.target.closest('button[aria-label="User profile"]')) {
            schedule();
        }
    }, { capture: true, signal: context.signal });
    onBodyMutations(schedule, context.signal);
    observeUrlChanges(schedule, context.signal);
    context.scope.add(() => {
        if (frame !== undefined) cancelAnimationFrame(frame);
        for (const dispose of subscriptions.values()) dispose();
        subscriptions.clear();
    });
    schedule();
}
