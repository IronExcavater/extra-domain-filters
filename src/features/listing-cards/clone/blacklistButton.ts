import { markOwned } from "../../../shared/dom/ownership";
import { replaceWithBinIcon, replaceWithUnbinIcon } from "../../../shared/ui/icons";

const BUTTON_CONTAINER_CLASS = "edf-listing-card-button-container";
const INACTIVE_SHORTLIST_CLASS_KEY = "edfInactiveShortlistClass";
const ACTIVE_SHORTLIST_CLASS_KEY = "edfActiveShortlistClass";
const KNOWN_INACTIVE_LISTING_CARD_CLASS = "css-bhcn0k";
const KNOWN_ACTIVE_LISTING_CARD_CLASS = "css-9xfbzc";
const NORMAL_LISTING_CARD_BUTTON_SKIN: ButtonSkin = {
    active: "css-1m4oqag",
    inactive: "css-zwjexa",
};
const LISTING_DETAILS_ACTIVE_CLASS = "css-11t19a7";
const ACTIVE_SHORTLIST_CLASS_NAMES = ["active", "is-active", "isActive", "shortlisted"];

export interface ButtonSkin {
    active?: string;
    inactive: string;
}

export const SHORTLIST_CARD_BUTTON_SKIN: ButtonSkin = {
    active: KNOWN_ACTIVE_LISTING_CARD_CLASS,
    inactive: KNOWN_INACTIVE_LISTING_CARD_CLASS,
};

export interface CloneBlacklistButtonOptions {
    appearance?: "native" | "shortlist";
    label?: string;
    skin?: ButtonSkin;
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

function getDocumentActiveShortlistClass(): string | undefined {
    return document.documentElement.dataset[ACTIVE_SHORTLIST_CLASS_KEY] ??
        document.querySelector<HTMLButtonElement>('[data-testid="listing-card-shortlist-shortlisted"]')?.className;
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

function getLocalActiveShortlistClass(shortlistButton: HTMLButtonElement): string | undefined {
    const container = shortlistButton.closest<HTMLElement>(
        '[data-testid="listing-card-container"], #shortlist, main, body',
    );
    const localButton = container?.querySelector<HTMLButtonElement>(
        '[data-testid="listing-card-shortlist-shortlisted"]',
    );

    return localButton && isShortlisted(localButton)
        ? localButton.className
        : undefined;
}

function setDocumentInactiveShortlistClass(className: string): void {
    document.documentElement.dataset[INACTIVE_SHORTLIST_CLASS_KEY] = className;
}

function setDocumentActiveShortlistClass(className: string): void {
    document.documentElement.dataset[ACTIVE_SHORTLIST_CLASS_KEY] = className;
}

export function captureNeutralShortlistClass(button: HTMLButtonElement, shortlistButton: HTMLButtonElement): void {
    if (!isShortlisted(shortlistButton)) {
        button.dataset.edfInactiveClass = shortlistButton.className;
        setDocumentInactiveShortlistClass(shortlistButton.className);
    } else {
        button.dataset.edfActiveClass = shortlistButton.className;
        setDocumentActiveShortlistClass(shortlistButton.className);
    }
}

function getCloneStateClasses(button: HTMLButtonElement): ButtonSkin | undefined {
    const inactive = button.dataset.edfInactiveClass;
    if (!inactive) return undefined;

    return {
        active: button.dataset.edfActiveClass,
        inactive,
    };
}

export function getButtonSkin(button: HTMLButtonElement): ButtonSkin {
    const activeClass = button.dataset.edfActiveClass;
    const inactiveClass = button.dataset.edfInactiveClass ?? button.className;

    return activeClass
        ? { active: activeClass, inactive: inactiveClass }
        : { inactive: inactiveClass };
}

function applyButtonSkin(button: HTMLButtonElement, skin: ButtonSkin): void {
    button.dataset.edfInactiveClass = skin.inactive;
    if (skin.active) button.dataset.edfActiveClass = skin.active;
    else delete button.dataset.edfActiveClass;
}

function setButtonClassState(button: HTMLButtonElement, active: boolean): void {
    const stateClasses = getCloneStateClasses(button);
    if (stateClasses) {
        const extensionClasses = [...button.classList].filter(className => className.startsWith("edf-"));
        const domainClass = active && stateClasses.active
            ? stateClasses.active
            : stateClasses.inactive;
        const nextClassName = [domainClass, ...extensionClasses].join(" ");

        if (button.className !== nextClassName) {
            button.className = nextClassName;
        }
        if (ACTIVE_SHORTLIST_CLASS_NAMES.some(className => button.classList.contains(className))) {
            button.classList.remove(...ACTIVE_SHORTLIST_CLASS_NAMES);
        }
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

function setButtonLabel(button: HTMLButtonElement, label: string | undefined): void {
    if (!label) return;

    const text = [...button.querySelectorAll<HTMLElement>("span")]
        .find(element => !element.querySelector("svg"));
    if (text && text.textContent !== label) text.textContent = label;
}

function usesUnbinIcon(button: HTMLButtonElement): boolean {
    return button.dataset.blacklistScope === "project" ||
        button.dataset.blacklistScope === "carousel";
}

function setBlacklistIcon(
    button: HTMLButtonElement,
    icon: SVGSVGElement,
    active: boolean,
): void {
    const iconState = active && usesUnbinIcon(button) ? "unbin" : "bin";

    (iconState === "unbin" ? replaceWithUnbinIcon : replaceWithBinIcon)(icon);
    icon.setAttribute("data-edf-icon-state", iconState);
}

export function setBlacklistButtonState(button: HTMLButtonElement, active: boolean, text = "Add to blacklist"): void {
    setButtonClassState(button, active);

    const icon = getOrCreateButtonIcon(button);
    setBlacklistIcon(button, icon, active);

    const nextActive = String(active);
    const nextLabel = active ? "Remove from blacklist" : text;

    if (button.dataset.active !== nextActive) button.dataset.active = nextActive;
    if (button.ariaLabel !== nextLabel) button.ariaLabel = nextLabel;
    if (button.title !== nextLabel) button.title = nextLabel;
    if (button.getAttribute("aria-pressed") !== nextActive) {
        button.setAttribute("aria-pressed", nextActive);
    }
}

function enableButtonTransition(button: HTMLButtonElement): void {
    button.dataset.edfReady = "false";
    requestAnimationFrame(() => {
        requestAnimationFrame(() => {
            if (button.isConnected) button.dataset.edfReady = "true";
        });
    });
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
    const isNativeAppearance = (options.appearance ?? "native") === "native";
    const fallbackInactiveClass = isShortlisted(shortlistButton)
        ? getLocalInactiveShortlistClass(shortlistButton) ??
            (isNativeAppearance
                ? NORMAL_LISTING_CARD_BUTTON_SKIN.inactive
                : getDocumentInactiveShortlistClass() ?? KNOWN_INACTIVE_LISTING_CARD_CLASS)
        : shortlistButton.className;
    const fallbackActiveClass =
        (isShortlisted(shortlistButton)
            ? shortlistButton.className
            : getLocalActiveShortlistClass(shortlistButton) ??
                (isNativeAppearance
                    ? NORMAL_LISTING_CARD_BUTTON_SKIN.active
                    : getDocumentActiveShortlistClass())) ??
        (shortlistButton.dataset.testid?.startsWith("listing-details__address-cta-button-shortlist")
            ? LISTING_DETAILS_ACTIVE_CLASS
            : undefined);
    const skin = options.skin ?? {
        active: fallbackActiveClass,
        inactive: fallbackInactiveClass,
    };

    button.type = "button";
    button.disabled = false;
    button.tabIndex = 0;
    button.removeAttribute("aria-disabled");
    button.setAttribute("data-testid", "listing-card-blacklist");
    button.dataset.edfButtonSkin = options.appearance ?? "native";
    applyButtonSkin(button, skin);
    setButtonLabel(button, options.label ?? "Blacklist");
    if (!isShortlisted(shortlistButton)) {
        setDocumentInactiveShortlistClass(shortlistButton.className);
    } else {
        setDocumentActiveShortlistClass(shortlistButton.className);
    }
    button.className = skin.inactive;
    button.classList.add("edf-blacklist-button");
    button.classList.remove(...ACTIVE_SHORTLIST_CLASS_NAMES);

    if (icon) setBlacklistButtonState(button, false);
    enableButtonTransition(button);

    return markOwned(button, "listing-blacklist-action");
}

export function cloneFeaturedControlButton(stepperButton: HTMLButtonElement): HTMLButtonElement {
    const button = stepperButton.cloneNode(true) as HTMLButtonElement;

    button.type = "button";
    button.disabled = false;
    button.removeAttribute("aria-disabled");
    button.setAttribute("data-testid", "listing-card-blacklist");
    button.dataset.edfInactiveClass = stepperButton.className;
    button.className = stepperButton.className;
    button.classList.add("edf-featured-blacklist-button");
    setBlacklistButtonState(button, false, "Blacklist featured properties");

    return markOwned(button, "featured-blacklist-action");
}

export function cloneFeaturedActionButton(
    stepperButton: HTMLButtonElement,
    testId: string,
    label: string,
): HTMLButtonElement {
    const button = stepperButton.cloneNode(true) as HTMLButtonElement;

    button.type = "button";
    button.disabled = false;
    button.removeAttribute("aria-disabled");
    button.setAttribute("data-testid", testId);
    button.ariaLabel = label;
    button.title = label;

    return markOwned(button, "featured-carousel-action");
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
