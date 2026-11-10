import { onBodyMutations } from "../dom/bodyMutations";
import { isOwnedNode, markOwned } from "../dom/ownership";
import { parseProfileUrl, type BlacklistProfile } from "../domain/blacklist/profiles";
import { getBlacklist, toggleBlacklistListing } from "../domain/blacklist/store";
import { isBlacklisted } from "../domain/matching";
import { bindListingCards } from "../features/listing-cards";
import { enableStickyHeader } from "../features/navigation";
import type { PageContext, PageMount } from "../platform/router";
import { onStorageChange } from "../platform/storage";
import { createSvgIcon } from "../ui/elements";
import { replaceWithBinIcon, replaceWithFilledBinIcon } from "../ui/icons";
import { showToast } from "../ui/toast";

const BUTTON_TEST_ID = "extra-domain-filters-profile-blacklist";

function textOf(element: Element): string {
    return element.textContent?.replace(/\s+/g, " ").trim() ?? "";
}

/** The profile's own Call/Email pair (the hero bar comes before any team member's). */
function findContactAnchor(): { anchor: HTMLElement; template: HTMLElement } | undefined {
    const controls = [...document.querySelectorAll<HTMLElement>("button, a")]
        .filter(element => !isOwnedNode(element) && element.getClientRects().length > 0);
    const call = controls.find(element => /^call$/i.test(textOf(element)));
    if (!call) return undefined;
    const group = call.parentElement?.parentElement ?? call.parentElement;
    const email = controls.find(element =>
        element !== call && group?.contains(element) && /^email$/i.test(textOf(element)));
    return { anchor: email ?? call, template: call };
}

function render(button: HTMLButtonElement, profile: BlacklistProfile, active: boolean): void {
    const noun = profile.kind === "agency" ? "agency" : "agent";
    const icon = button.querySelector("svg");
    const label = button.querySelector("span");
    button.dataset.active = String(active);
    button.setAttribute("aria-pressed", String(active));
    button.ariaLabel = active
        ? `Show listings from ${profile.name} again`
        : `Hide listings from ${profile.name} in your searches`;
    if (label) label.textContent = active ? "Blacklisted" : `Blacklist ${noun}`;
    if (icon) (active ? replaceWithFilledBinIcon : replaceWithBinIcon)(icon);
}

/**
 * Agency and agent profile pages get a toggle beside Domain's Call/Email that hides every
 * listing from this agency or agent in searches (as a revealable filter).
 */
function bindProfileBlacklist(context: PageContext): void {
    const parsed = parseProfileUrl(window.location.href);
    if (!parsed) return;

    const getProfile = (): BlacklistProfile =>
        ({ ...parsed, name: textOf(document.querySelector("h1") ?? document.body) || parsed.name });
    const sync = async (): Promise<void> => {
        const button = document.querySelector<HTMLButtonElement>(`[data-testid="${BUTTON_TEST_ID}"]`);
        if (button) render(button, getProfile(), isBlacklisted(await getBlacklist(), parsed.url));
    };
    const ensure = (): void => {
        if (document.querySelector(`[data-testid="${BUTTON_TEST_ID}"]`)) return;
        const contact = findContactAnchor();
        if (!contact) return;

        const button = markOwned(document.createElement("button"), "profile-blacklist");
        button.type = "button";
        // Borrow Domain's own outlined Call style so the toggle matches the bar it sits in.
        button.className = `${contact.template.className} edf-profile-blacklist`;
        button.dataset.testid = BUTTON_TEST_ID;
        button.append(createSvgIcon(replaceWithBinIcon, "edf-profile-blacklist-icon"), document.createElement("span"));
        button.addEventListener("click", async event => {
            event.preventDefault();
            event.stopPropagation();
            button.disabled = true;
            const profile = getProfile();
            try {
                const active = await toggleBlacklistListing({
                    displayAddress: profile.name,
                    text: "",
                    title: profile.name,
                    url: profile.url,
                });
                render(button, profile, active);
                showToast(active
                    ? `Listings from ${profile.name} are now hidden in your searches`
                    : `Listings from ${profile.name} are shown again`);
            } finally {
                button.disabled = false;
            }
        });
        contact.anchor.after(button);
        render(button, getProfile(), false);
        void sync();
    };

    ensure();
    onBodyMutations(ensure, context.signal);
    context.scope.add(onStorageChange("blacklist", () => void sync()));
    context.scope.add(() => document.querySelector(`[data-testid="${BUTTON_TEST_ID}"]`)?.remove());
}

const mountAgencyPage: PageMount = context => {
    enableStickyHeader(context);
    bindListingCards(context, { showBlacklistedView: false });
    bindProfileBlacklist(context);
};

export default mountAgencyPage;
