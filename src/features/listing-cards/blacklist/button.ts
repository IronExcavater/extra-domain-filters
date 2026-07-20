import { replaceWithBinIcon, replaceWithUnbinIcon } from "../../../shared/ui/icons";

const BUTTON_CONTAINER_CLASS = "edf-listing-card-button-container";
const BUTTON_GROUP_CLASS = "edf-listing-card-action-buttons";
const INACTIVE_SHORTLIST_CLASS_KEY = "edfInactiveShortlistClass";
const KNOWN_INACTIVE_LISTING_CARD_CLASS = "css-bhcn0k";
const LISTING_DETAILS_ACTIVE_CLASS = "css-11t19a7";
const ACTIVE_SHORTLIST_CLASS_NAMES = ["active", "is-active", "isActive", "shortlisted"];

interface CloneStateClasses {
    active?: string;
    inactive: string;
}

export interface CloneBlacklistButtonOptions {
    activeClassName?: string;
    inactiveClassName?: string;
}

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

function getLocalInactiveShortlistClass(shortlistButton: HTMLButtonElement): string | undefined {
    const container = shortlistButton.closest<HTMLElement>(
        '[data-testid="listing-card-container"], #shortlist, main, body',
    );
    const localButton = container?.querySelector<HTMLButtonElement>('[data-testid="listing-card-shortlist"]');

    return localButton && !isShortlisted(localButton)
        ? localButton.className
        : undefined;
}

function setDocumentInactiveShortlistClass(className: string): void {
    document.documentElement.dataset[INACTIVE_SHORTLIST_CLASS_KEY] = className;
}

export function captureNeutralShortlistClass(button: HTMLButtonElement, shortlistButton: HTMLButtonElement): void {
    if (!isShortlisted(shortlistButton)) {
        button.dataset.edfInactiveClass = shortlistButton.className;
        setDocumentInactiveShortlistClass(shortlistButton.className);
    }
}

function getCloneStateClasses(button: HTMLButtonElement): CloneStateClasses | undefined {
    const inactive = button.dataset.edfInactiveClass ?? button.dataset.edfBaseClass;
    if (!inactive) return undefined;

    return {
        active: button.dataset.edfActiveClass,
        inactive,
    };
}

function setButtonClassState(button: HTMLButtonElement, active: boolean): void {
    const stateClasses = getCloneStateClasses(button);
    if (stateClasses) {
        const extensionClasses = [...button.classList].filter(className => className.startsWith("edf-"));
        const domainClass = active && stateClasses.active
            ? stateClasses.active
            : stateClasses.inactive;

        button.className = [domainClass, ...extensionClasses].join(" ");
        button.classList.remove(...ACTIVE_SHORTLIST_CLASS_NAMES);
    }
}

function getOrCreateButtonIcon(button: HTMLButtonElement): SVGSVGElement {
    const existing = button.querySelector<SVGSVGElement>("svg");
    if (existing) return existing;

    const holder = button.querySelector("span") ?? button;
    const icon = document.createElementNS("http://www.w3.org/2000/svg", "svg");

    icon.setAttribute("aria-hidden", "true");
    holder.append(icon);
    return icon;
}

function setBlacklistIcon(icon: SVGSVGElement, active: boolean): void {
    const iconState = active ? "unbin" : "bin";
    if (icon.getAttribute("data-edf-icon-state") === iconState) return;

    icon.classList.remove("edf-blacklist-icon-swap");
    (active ? replaceWithUnbinIcon : replaceWithBinIcon)(icon);
    icon.setAttribute("data-edf-icon-state", iconState);
    requestAnimationFrame(() => {
        icon.classList.add("edf-blacklist-icon-swap");
    });
}

export function setBlacklistButtonState(button: HTMLButtonElement, active: boolean, text = "Add to blacklist"): void {
    setButtonClassState(button, active);

    const icon = getOrCreateButtonIcon(button);
    setBlacklistIcon(icon, active);

    button.dataset.active = String(active);
    button.ariaLabel = active ? "Remove from blacklist" : text;
    button.title = active ? "Remove from blacklist" : text;
    button.setAttribute("aria-pressed", String(active));
}

export function updateButton(button: HTMLButtonElement, active: boolean, text = "Add to blacklist"): void {
    setBlacklistButtonState(button, active, text);
}

export function removeFromShortlist(shortlistButton: HTMLButtonElement): void {
    if (!isShortlisted(shortlistButton)) return;

    requestAnimationFrame(() => shortlistButton.click());
}

export function cloneBlacklistButton(
    shortlistButton: HTMLButtonElement,
    options: CloneBlacklistButtonOptions = {},
): HTMLButtonElement {
    const button = shortlistButton.cloneNode(true) as HTMLButtonElement;
    const icon = button.querySelector("svg");
    const inactiveClass = isShortlisted(shortlistButton)
        ? options.inactiveClassName ??
            getLocalInactiveShortlistClass(shortlistButton) ??
            getDocumentInactiveShortlistClass() ??
            KNOWN_INACTIVE_LISTING_CARD_CLASS
        : options.inactiveClassName ?? shortlistButton.className;
    const activeClass = options.activeClassName ??
        (shortlistButton.dataset.testid === "listing-details__address-cta-button-shortlist"
            ? LISTING_DETAILS_ACTIVE_CLASS
            : undefined);

    button.type = "button";
    button.disabled = false;
    button.tabIndex = 0;
    button.removeAttribute("aria-disabled");
    button.setAttribute("data-testid", "listing-card-blacklist");
    button.dataset.edfInactiveClass = inactiveClass;
    delete button.dataset.edfBaseClass;
    if (activeClass) button.dataset.edfActiveClass = activeClass;
    if (!isShortlisted(shortlistButton)) {
        setDocumentInactiveShortlistClass(shortlistButton.className);
    }
    button.className = inactiveClass;
    button.classList.add("edf-blacklist-button");
    button.classList.remove(...ACTIVE_SHORTLIST_CLASS_NAMES);

    if (icon) setBlacklistIcon(icon, false);

    return button;
}

export function insertBlacklistButton(
    shortlistButton: HTMLButtonElement,
    blacklistButton: HTMLButtonElement
): void {
    const parent = shortlistButton.parentElement;
    if (!parent) return;

    parent.classList.add(BUTTON_CONTAINER_CLASS);

    const existingGroup = parent.querySelector<HTMLElement>(`:scope > .${BUTTON_GROUP_CLASS}`);
    if (existingGroup) {
        existingGroup.append(blacklistButton);
        return;
    }

    const group = document.createElement("span");
    group.className = BUTTON_GROUP_CLASS;
    shortlistButton.replaceWith(group);
    group.append(shortlistButton, blacklistButton);
}
