import { createClaimTracker } from "../../shared/claim";
import { Logger } from "../../shared/logging";
import { PageContext } from "../../shared/router";
import { BlacklistEntry } from "../../shared/settings";
import { getFromStorage, onStorageChange } from "../../shared/storage";
import { bindLazyTrigger } from "../../shared/trigger";
import { cloneMenuItem } from "./clone/menuItem";

const claim = createClaimTracker<Element>();

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
        if (!sourceItem || !claim(sourceItem)) continue;

        const blacklistUrl = new URL(shortlistLink.href);
        blacklistUrl.searchParams.set('blacklist', '1');

        const blacklistItem = await cloneMenuItem(sourceItem as HTMLLIElement, {
            label: 'Blacklist',
            href: blacklistUrl.href,
        });

        sourceItem.after(blacklistItem);

        const badge = blacklistItem.querySelector<HTMLElement>('[data-testid="account-menu__blacklist-count"]');
        if (badge) {
            const updateBadge = (entries: BlacklistEntry[] | undefined): void => {
                badge.textContent = String(entries?.length ?? 0);
            };

            updateBadge(await getFromStorage<BlacklistEntry[]>('blacklist'));
            onStorageChange<BlacklistEntry[]>('blacklist', updateBadge);
        }

        logger.info('Appended blacklist menu item');
    }
}
