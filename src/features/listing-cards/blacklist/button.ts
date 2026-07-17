import { replaceWithBinIcon, replaceWithUnbinIcon } from "../../../shared/ui/icons";

const BUTTON_CONTAINER_CLASS = "edf-listing-card-button-container";
const INACTIVE_SHORTLIST_CLASS_KEY = "edfInactiveShortlistClass";

export function isShortlisted(shortlistButton: HTMLButtonElement): boolean {
    return (
        shortlistButton.dataset.testid?.includes("shortlisted") === true ||
        /^remove\b/i.test(shortlistButton.ariaLabel ?? "")
    );
}

function getDocumentInactiveShortlistClass(): string | undefined {
    return document.documentElement.dataset[INACTIVE_SHORTLIST_CLASS_KEY] ??
        document.querySelector<HTMLButtonElement>('[data-testid="listing-card-shortlist"]')?.className;
}

function setDocumentInactiveShortlistClass(className: string): void {
    document.documentElement.dataset[INACTIVE_SHORTLIST_CLASS_KEY] = className;
}

export function captureNeutralShortlistClass(button: HTMLButtonElement, shortlistButton: HTMLButtonElement): void {
    if (!isShortlisted(shortlistButton)) {
        button.dataset.edfBaseClass = shortlistButton.className;
        setDocumentInactiveShortlistClass(shortlistButton.className);
    }
}

export function updateButton(button: HTMLButtonElement, active: boolean, text = "Add to blacklist"): void {
    const icon = button.querySelector("svg");
    if (icon) (active ? replaceWithUnbinIcon : replaceWithBinIcon)(icon);

    button.dataset.active = String(active);
    button.ariaLabel = active ? "Remove from blacklist" : text;
    button.title = active ? "Remove from blacklist" : text;
    button.setAttribute("aria-pressed", String(active));
}

export function removeFromShortlist(shortlistButton: HTMLButtonElement): void {
    if (!isShortlisted(shortlistButton)) return;

    requestAnimationFrame(() => shortlistButton.click());
}

export function cloneBlacklistButton(shortlistButton: HTMLButtonElement): HTMLButtonElement {
    const button = shortlistButton.cloneNode(true) as HTMLButtonElement;
    const icon = button.querySelector("svg");

    button.type = "button";
    button.disabled = false;
    button.tabIndex = 0;
    button.removeAttribute("aria-disabled");
    button.setAttribute("data-testid", "listing-card-blacklist");
    button.dataset.edfBaseClass = isShortlisted(shortlistButton)
        ? getDocumentInactiveShortlistClass() ?? shortlistButton.className
        : shortlistButton.className;
    if (!isShortlisted(shortlistButton)) {
        setDocumentInactiveShortlistClass(shortlistButton.className);
    }
    button.className = button.dataset.edfBaseClass;
    button.classList.add("edf-blacklist-button");
    button.classList.remove("active", "is-active", "isActive", "shortlisted");

    if (icon) replaceWithBinIcon(icon);

    return button;
}

export function insertBlacklistButton(
    shortlistButton: HTMLButtonElement,
    blacklistButton: HTMLButtonElement
): void {
    const parent = shortlistButton.parentElement;
    if (!parent) return;

    parent.classList.add(BUTTON_CONTAINER_CLASS);
    shortlistButton.after(blacklistButton);
}
