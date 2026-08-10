export function isShortlisted(button: HTMLButtonElement): boolean {
    return button.dataset.testid?.includes("shortlisted") === true
        || /^remove\b/i.test(button.ariaLabel ?? "");
}

export function removeFromShortlist(button: HTMLButtonElement): void {
    if (!isShortlisted(button)) return;
    requestAnimationFrame(() => button.click());
}
