export interface DomainProfileHosts {
    contentHost: HTMLElement;
    nativeContent: HTMLElement;
    navigationList: HTMLUListElement;
}

export interface DomainAccountMenuHost {
    list: HTMLElement;
    shortlistItem: HTMLLIElement;
    shortlistLink: HTMLAnchorElement;
}

function isProfileNavigation(list: HTMLUListElement): boolean {
    return /my details|account security/i.test(list.textContent ?? "");
}

export function findDomainProfileHosts(root: ParentNode = document): DomainProfileHosts | undefined {
    const navigationList = [...root.querySelectorAll<HTMLUListElement>("nav ul")]
        .find(isProfileNavigation);
    const nav = navigationList?.closest<HTMLElement>("nav");
    if (!navigationList || !nav) return undefined;

    for (
        let ancestor = nav.parentElement;
        ancestor && ancestor !== document.body;
        ancestor = ancestor.parentElement
    ) {
        const navBranch = [...ancestor.children].find(child => child.contains(nav));
        const nativeContent = [...ancestor.children]
            .find((child): child is HTMLElement =>
                child instanceof HTMLElement &&
                child !== navBranch &&
                (
                    child.querySelector("form, input, section, article, [data-testid]") !== null ||
                    (child.textContent?.trim().length ?? 0) > 80
                )
            );
        if (nativeContent) {
            return { contentHost: ancestor, nativeContent, navigationList };
        }
    }

    return undefined;
}

export function findDomainAccountMenuHosts(root: ParentNode = document): DomainAccountMenuHost[] {
    const hosts = new Map<HTMLElement, DomainAccountMenuHost>();
    const links = [...root.querySelectorAll<HTMLAnchorElement>(
        'a[data-menu-item-name="Shortlist"], a[href*="/user/shortlist"]',
    )];

    for (const shortlistLink of links) {
        if (shortlistLink.closest('[data-testid="account-menu__blacklist-item"]')) continue;
        const shortlistItem = shortlistLink.closest<HTMLLIElement>("li");
        const list = shortlistItem?.parentElement;
        if (!shortlistItem || !list || hosts.has(list)) continue;
        hosts.set(list, { list, shortlistItem, shortlistLink });
    }

    return [...hosts.values()];
}
