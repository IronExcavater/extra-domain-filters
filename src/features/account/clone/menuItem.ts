import { getFromStorage, onStorageChange } from "../../../shared/platform/storage";
import { replaceWithBinIcon } from "../../../shared/ui/icons";
import { match } from "../../../shared/utils/regex";

const isBlacklistRoute = match({ path: '/user/shortlist', search: { blacklist: '1' } });

export interface MenuItemActiveClasses {
    activeItemClassName: string;
    activeLinkClassName: string;
    inactiveItemClassName: string;
    inactiveLinkClassName: string;
}

export interface MenuItemConfig {
    label: string;
    href: string;
    active?: boolean;
    badge?: false | { storageKey: string };
    existingItem?: HTMLLIElement;
    inactivePeer?: HTMLLIElement;
    sourceActive?: boolean;
}

const activeBadgeSubscriptions = new Map<string, () => void>();

async function bindBadge(storageKey: string, badge: HTMLElement): Promise<void> {
    const setCount = (count: number): void => {
        badge.textContent = String(count);
        badge.hidden = count === 0;
    };

    activeBadgeSubscriptions.get(storageKey)?.();

    setCount((await getFromStorage<unknown[]>(storageKey))?.length ?? 0);
    activeBadgeSubscriptions.set(
        storageKey,
        onStorageChange<unknown[]>(storageKey, entries => setCount(entries?.length ?? 0)),
    );
}

function captureMenuItemClasses(
    activeItem: HTMLLIElement,
    inactiveItem: HTMLLIElement,
): MenuItemActiveClasses | undefined {
    const activeLink = activeItem.querySelector<HTMLAnchorElement>("a");
    const inactiveLink = inactiveItem.querySelector<HTMLAnchorElement>("a");

    if (!activeLink || !inactiveLink) return undefined;

    return {
        activeItemClassName: activeItem.className,
        activeLinkClassName: activeLink.className,
        inactiveItemClassName: inactiveItem.className,
        inactiveLinkClassName: inactiveLink.className,
    };
}

function setMenuItemActiveState(
    item: HTMLLIElement,
    active: boolean,
    classes?: MenuItemActiveClasses,
): void {
    const link = item.querySelector<HTMLAnchorElement>("a");

    if (classes) {
        item.className = active
            ? classes.activeItemClassName
            : classes.inactiveItemClassName;

        if (link) {
            link.className = active
                ? classes.activeLinkClassName
                : classes.inactiveLinkClassName;
        }
    }

    if (!link) return;

    if (active) link.setAttribute("aria-current", "page");
    else link.removeAttribute("aria-current");
}

function getActiveClasses(
    source: HTMLLIElement,
    item: HTMLLIElement,
    config: MenuItemConfig,
): MenuItemActiveClasses | undefined {
    if (!config.inactivePeer) return undefined;

    const currentActive = [source, item]
        .find(candidate =>
            candidate.querySelector<HTMLAnchorElement>("a")?.getAttribute("aria-current") === "page"
        );

    return captureMenuItemClasses(
        currentActive ?? (config.active ? item : source),
        config.inactivePeer,
    );
}

function setLabel(link: HTMLAnchorElement, labelText: string): void {
    const label = [...link.childNodes].find(node => node.nodeType === Node.TEXT_NODE);
    if (label) label.textContent = labelText;
}

export async function cloneMenuItem(
    source: HTMLLIElement,
    config: MenuItemConfig,
): Promise<HTMLLIElement> {
    const item = config.existingItem ?? source.cloneNode(true) as HTMLLIElement;
    const link = item.querySelector<HTMLAnchorElement>('a');
    const icon = link?.querySelector('svg');
    const badge = link?.querySelector<HTMLElement>('span');

    if (!link || !icon || !badge) throw new Error('Failed to locate account menu item elements');

    setLabel(link, config.label);

    replaceWithBinIcon(icon);

    link.href = config.href;
    link.dataset.menuItemName = config.label;

    item.setAttribute('data-testid', 'account-menu__blacklist-item');
    item.hidden = false;
    item.removeAttribute('aria-hidden');
    item.style.display = '';

    const activeClasses = getActiveClasses(source, item, config);
    setMenuItemActiveState(
        source,
        config.sourceActive ?? !(config.active ?? isBlacklistRoute(new URL(window.location.href))),
        activeClasses,
    );
    setMenuItemActiveState(
        item,
        config.active ?? isBlacklistRoute(new URL(window.location.href)),
        activeClasses,
    );

    if (config.badge) {
        badge.setAttribute('data-testid', 'account-menu__blacklist-count');
        await bindBadge(config.badge.storageKey, badge);
    } else {
        badge.remove();
    }

    return item;
}
