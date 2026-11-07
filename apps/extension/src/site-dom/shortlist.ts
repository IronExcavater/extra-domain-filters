const internalShortlistRemovals = new WeakSet<HTMLButtonElement>();

export function isShortlisted(button: HTMLButtonElement): boolean {
    return button.dataset.testid?.includes("shortlisted") === true
        || /^remove\b/i.test(button.ariaLabel ?? "");
}

export function removeFromShortlist(button: HTMLButtonElement): void {
    if (!isShortlisted(button)) return;
    internalShortlistRemovals.add(button);
    requestAnimationFrame(() => {
        if (!isShortlisted(button)) {
            internalShortlistRemovals.delete(button);
            return;
        }
        button.click();
        queueMicrotask(() => internalShortlistRemovals.delete(button));
    });
}

/** Distinguishes our mutual-exclusion click from a shortlist action initiated by the user. */
export function consumeInternalShortlistRemoval(button: HTMLButtonElement): boolean {
    if (!internalShortlistRemovals.has(button)) return false;
    internalShortlistRemovals.delete(button);
    return true;
}
