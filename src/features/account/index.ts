import { Logger } from "../../shared/logging";
import { PageContext } from "../../shared/router";
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

        const blacklistItem = await cloneMenuItem(sourceItem as HTMLLIElement, {
            label: 'Blacklist',
            href: blacklistUrl.href,
            badge: { storageKey: 'blacklist' },
        });

        sourceItem.after(blacklistItem);

        logger.info('Appended blacklist menu item');
    }
}
