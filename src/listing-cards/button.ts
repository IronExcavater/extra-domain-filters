import { replaceWithBinIcon, replaceWithUnbinIcon } from "../core/icons";
import { PageContext } from "../core/router";

const BUTTON_CONTAINER_CLASS = "edf-listing-card-button-container";

export function isShortlisted(shortlistButton: HTMLButtonElement): boolean {
    return (
        shortlistButton.dataset.testid?.includes("shortlisted") === true ||
        /^remove\b/i.test(shortlistButton.ariaLabel ?? "")
    );
}

// Domain gives the shortlist button a visually "active" look (filled/colored) once shortlisted —
// a cosmetic state of that OTHER toggle. The blacklist button must never inherit that look just
// because its sibling happens to be shortlisted right now: its own active/inactive appearance is
// driven entirely by its own data-active state (see main.css). So only ever capture the
// sibling's neutral (not-shortlisted) class as the shared base styling, and keep using the last
// one seen if the sibling is currently in its active look.
export function captureNeutralShortlistClass(button: HTMLButtonElement, shortlistButton: HTMLButtonElement): void {
    if (!isShortlisted(shortlistButton)) {
        button.dataset.edfBaseClass = shortlistButton.className;
    }
}

export function updateButton(button: HTMLButtonElement, active: boolean, text = "Add to blacklist"): void {
    const extensionClasses = [...button.classList].filter(className => className.startsWith("edf-"));
    const baseClass = button.dataset.edfBaseClass;

    if (baseClass) {
        button.className = [baseClass, ...extensionClasses].join(" ");
    }

    // The project button is a bare icon (no surrounding label/summary row to say "unblacklist"),
    // so it swaps to the struck-through bin icon itself once active to signal the toggle.
    if (button.dataset.blacklistScope === "project") {
        const icon = button.querySelector("svg");
        if (icon) (active ? replaceWithUnbinIcon : replaceWithBinIcon)(icon);
    }

    button.dataset.active = String(active);
    button.ariaLabel = active ? "Remove from blacklist" : text;
    button.title = active ? "Remove from blacklist" : text;
    button.setAttribute("aria-pressed", String(active));
}

// Domain re-renders the shortlist button with a different class when its shortlisted state
// changes, so keep the blacklist button's base class synced to it live rather than snapshotting
// once — but only ever adopt the neutral (not-shortlisted) look, per captureNeutralShortlistClass.
export function watchShortlistButtonClass(
    shortlistButton: HTMLButtonElement,
    button: HTMLButtonElement,
    context: PageContext,
): void {
    const observer = new MutationObserver(() => {
        captureNeutralShortlistClass(button, shortlistButton);
        updateButton(button, button.dataset.active === "true");
    });
    observer.observe(shortlistButton, { attributeFilter: ["class"] });
    context.signal.addEventListener("abort", () => observer.disconnect(), { once: true });
}

export function removeFromShortlist(shortlistButton: HTMLButtonElement): void {
    if (!isShortlisted(shortlistButton)) return;

    requestAnimationFrame(() => shortlistButton.click());
}

export function cloneBlacklistButton(shortlistButton: HTMLButtonElement): HTMLButtonElement {
    const button = shortlistButton.cloneNode(true) as HTMLButtonElement;
    const icon = button.querySelector("svg");

    button.type = "button";
    button.setAttribute("data-testid", "listing-card-blacklist");
    captureNeutralShortlistClass(button, shortlistButton);

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
