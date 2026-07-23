import { onBodyMutations } from "../../shared/dom/bodyMutations";
import { Logger } from "../../shared/platform/logging";
import { observeUrlChanges, PageContext } from "../../shared/platform/router";
import { cloneMenuItem } from "./clone/menuItem";

let activeInjection: Promise<void> | undefined;

export function bindAccountMenuTrigger(context: PageContext): void {
    let frame: number | undefined;
    const menuItemSelector = 'a[data-menu-item-name="Shortlist"], a[href*="/user/shortlist"]';
    const scheduleInject = (): void => {
        if (frame !== undefined) return;

        frame = requestAnimationFrame(() => {
            frame = undefined;
            void injectAccountMenu(context.logger);
        });
    };

    document.addEventListener("click", event => {
        if (
            event.target instanceof Element &&
            event.target.closest('button[aria-label="User profile"]')
        ) {
            context.logger.info('Trigger clicked', 'button[aria-label="User profile"]');
            scheduleInject();
        }
    }, { capture: true, signal: context.signal });

    onBodyMutations(mutations => {
        if (
            mutations.some(mutation =>
                [...mutation.addedNodes].some(node =>
                    node instanceof Element &&
                    !node.closest('[data-testid="account-menu__blacklist-item"]') &&
                    (
                        node.matches(menuItemSelector) ||
                        Boolean(node.querySelector(menuItemSelector))
                    )
                )
            )
        ) {
            scheduleInject();
        }
    }, context.signal);
    observeUrlChanges(scheduleInject, context.signal);
    context.scope.add(() => {
        if (frame !== undefined) cancelAnimationFrame(frame);
    });
}

export function injectAccountMenu(logger: Logger): Promise<void> {
    activeInjection ??= performAccountMenuInjection(logger).finally(() => {
        activeInjection = undefined;
    });
    return activeInjection;
}

async function performAccountMenuInjection(logger: Logger): Promise<void> {
    const blacklistActive = new URL(window.location.href).searchParams.get('blacklist') === '1';
    const shortlistLinks = [...document.querySelectorAll<HTMLAnchorElement>("a")]
        .filter(link =>
            !link.closest('[data-testid="account-menu__blacklist-item"]') &&
            (
                link.dataset.menuItemName === "Shortlist" ||
                link.href.includes("/user/shortlist") ||
                link.textContent?.trim().toLowerCase() === "shortlist"
            )
        );

    if (shortlistLinks.length === 0) return;

    const sourcesByList = new Map<HTMLElement, { item: HTMLLIElement; link: HTMLAnchorElement }>();
    for (const shortlistLink of shortlistLinks) {
        const sourceItem = shortlistLink.closest('li');
        const itemList = sourceItem?.parentElement;
        if (!sourceItem || !itemList) continue;
        if (!shortlistLink.querySelector("svg") || !shortlistLink.querySelector("span")) {
            continue;
        }
        if (!sourcesByList.has(itemList)) {
            sourcesByList.set(itemList, { item: sourceItem as HTMLLIElement, link: shortlistLink });
        }
    }

    for (const { item: sourceItem, link: shortlistLink } of sourcesByList.values()) {
        const itemList = sourceItem.parentElement;
        if (!itemList) continue;
        const blacklistUrl = new URL(shortlistLink.href);
        blacklistUrl.searchParams.set('blacklist', '1');
        const existingItems = [
            ...itemList.querySelectorAll<HTMLLIElement>('[data-testid="account-menu__blacklist-item"]'),
        ];
        const existing = existingItems[0];
        const inactiveItem = [...itemList.children]
            .find(item =>
                item instanceof HTMLLIElement &&
                item !== sourceItem &&
                item.getAttribute('data-testid') !== 'account-menu__blacklist-item' &&
                item.querySelector<HTMLAnchorElement>("a")?.getAttribute("aria-current") !== "page" &&
                item.querySelector<HTMLAnchorElement>("a")?.dataset.selected !== "true" &&
                item.dataset.selected !== "true"
            );

        for (const item of existingItems) {
            if (item !== existing) item.remove();
        }

        const blacklistItem = await cloneMenuItem(sourceItem as HTMLLIElement, {
            label: 'Blacklist',
            href: blacklistUrl.href,
            active: blacklistActive,
            existingItem: existing,
            inactivePeer: inactiveItem instanceof HTMLLIElement ? inactiveItem : undefined,
            badge: { storageKey: 'blacklist' },
        });

        if (!existing) {
            logger.info('Injecting account menu');
            itemList.insertBefore(blacklistItem, sourceItem.nextSibling);
        } else if (blacklistItem.previousElementSibling !== sourceItem) {
            itemList.insertBefore(blacklistItem, sourceItem.nextSibling);
        }

        logger.info('Appended blacklist menu item');
    }
}
