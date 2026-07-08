import { match } from "../../../shared/regex";

const isBlacklistRoute = match({ path: '/user/shortlist', search: { blacklist: '1' } });

export async function cloneMenuItem(
    source: HTMLLIElement,
    config: { label: string; href: string },
): Promise<HTMLLIElement> {
    const item = source.cloneNode(true) as HTMLLIElement;
    const link = item.querySelector<HTMLAnchorElement>('a');
    const badge = link?.querySelector('span');

    if (!link || !badge) throw new Error('Failed to locate account menu item elements');

    // The label is a bare text node sandwiched between the icon <svg> and the count <span> —
    // setting link.textContent would wipe both of those, the same mistake fixed earlier in
    // filters.ts for a mixed icon+heading container.
    const label = [...link.childNodes].find(node => node.nodeType === Node.TEXT_NODE);
    if (label) label.textContent = config.label;

    link.href = config.href;
    link.dataset.menuItemName = config.label;
    badge.setAttribute('data-testid', 'account-menu__blacklist-count');

    item.setAttribute('data-testid', 'account-menu__blacklist-item');

    if (isBlacklistRoute(new URL(window.location.href))) link.setAttribute('aria-current', 'page');
    else link.removeAttribute('aria-current');

    return item;
}
