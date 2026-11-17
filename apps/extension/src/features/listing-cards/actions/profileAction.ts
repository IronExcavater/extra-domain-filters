import { markOwned } from "../../../dom/ownership";
import { createProfile, type BlacklistProfile } from "../../../domain/blacklist/profiles";
import { toggleBlacklistProfile } from "../../../domain/blacklist/store";
import type { ListingSnapshot } from "../../../domain/matching";
import { createSvgIcon } from "../../../ui/elements";
import { replaceWithBinIcon } from "../../../ui/icons";
import { openPopover } from "../../../ui/popover";
import { showToast } from "../../../ui/toast";
import { setTooltipText } from "../../../ui/tooltip";

const BRANDING_SELECTOR = '[data-testid="listing-card-branding"]';
const ACTION_TEST_ID = "extra-domain-filters-profile-action";

function titleCase(text: string): string {
    return text === text.toUpperCase()
        ? text.toLowerCase().replace(/\b\w/g, letter => letter.toUpperCase())
        : text;
}

/** The agency and agents a card names: Domain's data for ids, its branding images for tidy names. */
function readProfiles(branding: HTMLElement, listing: ListingSnapshot): BlacklistProfile[] {
    const images = [...branding.querySelectorAll<HTMLImageElement>("img[alt]")];
    const agencyName = images.map(image => image.alt.match(/^logo for (.+)$/i)?.[1]?.trim()).find(Boolean) ??
        (listing.agencyName && titleCase(listing.agencyName));
    const agentNames = new Set([
        ...images.flatMap(image => image.alt.match(/^agent\s*-\s*(.+)$/i)?.[1]?.trim() ?? []),
        ...listing.agentNames ?? [],
    ]);
    return [
        ...(listing.agencyId && agencyName ? [createProfile("agency", agencyName, listing.agencyId)] : []),
        ...[...agentNames].map(name => createProfile("agent", name)),
    ];
}

function createMenu(profiles: BlacklistProfile[], logo: string | undefined, close: () => void): HTMLElement {
    const menu = document.createElement("div");
    const heading = document.createElement("p");
    menu.className = "edf-profile-menu";
    menu.setAttribute("role", "menu");
    heading.className = "edf-profile-menu-heading";
    heading.textContent = "Hide every listing from";
    menu.append(heading);
    for (const profile of profiles) {
        const item = document.createElement("button");
        const name = document.createElement("span");
        const kind = document.createElement("span");
        item.type = "button";
        item.className = "edf-profile-menu-item";
        item.setAttribute("role", "menuitem");
        name.className = "edf-profile-menu-name";
        name.textContent = profile.name;
        kind.className = "edf-profile-menu-kind";
        kind.textContent = profile.kind === "agency" ? "Agency" : "Agent";
        item.append(name, kind);
        item.addEventListener("click", async () => {
            item.disabled = true;
            const hidden = await toggleBlacklistProfile(profile, { thumbnailUrl: profile.kind === "agency" ? logo : undefined });
            close();
            if (!hidden) return;
            showToast(`Listings from ${profile.name} are hidden`, "page", {
                action: { label: "Undo", onClick: () => void toggleBlacklistProfile(profile) },
            });
        });
        menu.append(item);
    }
    return menu;
}

/**
 * A quiet button in a result card's agency strip (shown on hover or focus) that hides every
 * listing from that agency or one of its agents.
 */
export function ensureProfileAction(card: Element, listing: ListingSnapshot): void {
    const branding = card.querySelector<HTMLElement>(BRANDING_SELECTOR);
    if (!branding) return;
    const profiles = readProfiles(branding, listing);
    let button = branding.querySelector<HTMLButtonElement>(`[data-testid="${ACTION_TEST_ID}"]`);
    if (profiles.length === 0) {
        button?.remove();
        return;
    }
    if (button) {
        button.onclick = null;
    } else {
        button = markOwned(document.createElement("button"), "profile-action");
        button.type = "button";
        button.className = "edf-card-profile-action";
        button.dataset.testid = ACTION_TEST_ID;
        button.ariaLabel = "Hide this agency or agent";
        button.setAttribute("aria-haspopup", "menu");
        button.append(createSvgIcon(replaceWithBinIcon));
        setTooltipText(button, "Hide this agency or agent");
        branding.classList.add("edf-card-branding");
        branding.append(button);
    }
    const logo = branding.querySelector<HTMLImageElement>('img[alt^="Logo for" i]')?.src;
    const anchor = button;
    anchor.onclick = event => {
        event.preventDefault();
        event.stopPropagation();
        const popover = openPopover({
            anchor,
            content: createMenu(profiles, logo, () => popover.close()),
            label: "Hide this agency or agent",
        });
    };
}
