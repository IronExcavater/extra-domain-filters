import { Logger } from "../../shared/logging";
import { PageContext } from "../../shared/router";
import { BlacklistEntry } from "../../shared/settings";
import { getFromStorage, onStorageChange } from "../../shared/storage";
import { bindLazyTrigger } from "../../shared/trigger";
import { cloneMenuItem } from "./clone/menuItem";

export function bindAccountMenuTrigger(context: PageContext): void {
    bindLazyTrigger(
        ['button[aria-label="User profile"]'],
        'a[data-menu-item-name="Shortlist"]',
        ctx => injectAccountMenu(ctx.logger),
        context,
    );
}

// Only one menu is ever open at a time, so a single slot for the current badge subscription is
// enough — unsubscribing the old one before creating a new one avoids piling up listeners bound
// to detached badge elements every time the menu reopens.
let unsubscribeBadge: (() => void) | undefined;

export async function injectAccountMenu(logger: Logger): Promise<void> {
    logger.info('Injecting account menu');

    for (const shortlistLink of document.querySelectorAll<HTMLAnchorElement>('a[data-menu-item-name="Shortlist"]')) {
        const sourceItem = shortlistLink.closest('li');
        if (!sourceItem) continue;

        // React re-renders the menu's item list on reopen and drops whatever DOM it doesn't
        // recognize as its own — including our injected sibling — even though sourceItem itself
        // persists (same object). Checking the live DOM instead of a one-time claim means a
        // dropped clone gets reinserted instead of staying gone for good.
        if (sourceItem.nextElementSibling?.getAttribute('data-testid') === 'account-menu__blacklist-item') continue;

        const blacklistUrl = new URL(shortlistLink.href);
        blacklistUrl.searchParams.set('blacklist', '1');

        const { item: blacklistItem, setBadgeCount } = await cloneMenuItem(sourceItem as HTMLLIElement, {
            label: 'Blacklist',
            href: blacklistUrl.href,
        });

        sourceItem.after(blacklistItem);

        unsubscribeBadge?.();
        setBadgeCount((await getFromStorage<BlacklistEntry[]>('blacklist'))?.length ?? 0);
        unsubscribeBadge = onStorageChange<BlacklistEntry[]>('blacklist', entries => setBadgeCount(entries?.length ?? 0));

        logger.info('Appended blacklist menu item');
    }
}
