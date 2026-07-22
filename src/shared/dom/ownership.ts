export const OWNED_ELEMENT_ATTRIBUTE = "data-extra-domain-filters-owner";

export function markOwned<T extends Element>(element: T, owner: string): T {
    element.setAttribute(OWNED_ELEMENT_ATTRIBUTE, owner);
    return element;
}

export function getOwnedRoot(node: Node): Element | undefined {
    const element = node instanceof Element ? node : node.parentElement;
    return element?.closest(`[${OWNED_ELEMENT_ATTRIBUTE}]`) ?? undefined;
}

export function isOwnedNode(node: Node): boolean {
    return getOwnedRoot(node) !== undefined;
}
