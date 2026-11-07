import { onBodyMutations } from "../../dom/bodyMutations";
import { markOwned } from "../../dom/ownership";
import { Logger } from "../../platform/logging";
import { observeUrlChanges, PageContext } from "../../platform/router";
import { getFromStorage, onStorageChange } from "../../platform/storage";
import { findDomainAccountMenuHosts, type DomainAccountMenuHost } from "../../site-dom/profile";
import { createSvgIcon } from "../../ui/elements";
import { replaceWithBinIcon } from "../../ui/icons";

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
    // Reserve the final count pill geometry while storage is being read. This
    // prevents the menu item shifting after it is first painted.
    if (!badge.textContent) badge.textContent = "0";
    const render = (entries: readonly unknown[] | undefined): void => {
        badge.textContent = String(getActiveCount(entries));
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
    const icon = createSvgIcon(replaceWithBinIcon, "edf-account-menu-icon");
    const badge = document.createElement("span");
    const url = new URL(host.shortlistLink.href);

    url.searchParams.set("blacklist", "1");
    item.classList.add("edf-account-menu-item");
    item.dataset.testid = "account-menu__blacklist-item";
    item.dataset.edfAccountMenuState = active ? "active" : "inactive";
    link.className = "edf-account-menu-link";
    link.href = url.href;
    link.ariaLabel = "Blacklist";
    if (active) link.setAttribute("aria-current", "page");
    badge.className = "edf-account-menu-badge";
    badge.dataset.testid = "account-menu__blacklist-count";
    // Domain account-menu links use a direct label text node between the icon and
    // count. An extra label wrapper changes flex sizing and creates excess spacing.
    link.append(icon, document.createTextNode("Blacklist"), badge);
    item.append(link);
    bindBadge(item, badge, signal);
    return item;
}

function normalizeAccountMenuItem(
    item: HTMLElement,
    host: DomainAccountMenuHost,
    signal?: AbortSignal,
): HTMLAnchorElement | undefined {
    const link = item.querySelector<HTMLAnchorElement>(":scope > a");
    if (!link) return undefined;
    const icon = link.querySelector<SVGSVGElement>(":scope > .edf-account-menu-icon")
        ?? createSvgIcon(replaceWithBinIcon, "edf-account-menu-icon");
    const existingBadge = link.querySelector<HTMLElement>(":scope > .edf-account-menu-badge");
    const badge = existingBadge ?? document.createElement("span");
    const label = link.childNodes[1];
    const validStructure = link.childNodes.length === 3 &&
        link.firstChild === icon &&
        label?.nodeType === Node.TEXT_NODE &&
        label.textContent === "Blacklist" &&
        link.lastChild === badge;

    link.className = "edf-account-menu-link";
    delete link.dataset.menuItemName;
    link.ariaLabel = "Blacklist";
    const url = new URL(host.shortlistLink.href);
    url.searchParams.set("blacklist", "1");
    link.href = url.href;
    badge.className = "edf-account-menu-badge";
    badge.dataset.testid = "account-menu__blacklist-count";
    if (!validStructure) link.replaceChildren(icon, document.createTextNode("Blacklist"), badge);
    if (!existingBadge) {
        subscriptions.get(item)?.();
        subscriptions.delete(item);
    }
    if (!subscriptions.has(item)) bindBadge(item, badge, signal);
    return link;
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
        const candidate = existingItems.shift();
        const existing = candidate?.querySelector(":scope > .edf-account-menu-link")
            ? candidate
            : undefined;
        if (candidate && !existing) candidate.remove();
        existingItems.forEach(item => item.remove());
        const item = existing ?? createAccountMenuItem(host, active, signal);
        const link = normalizeAccountMenuItem(item, host, signal);

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
