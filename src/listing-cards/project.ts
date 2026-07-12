import { createClaimTracker } from "../core/claim";
import { queueForegroundContrastSync } from "../core/contrast";
import { replaceWithBinIcon } from "../core/icons";
import { PageContext } from "../core/router";
import { getFromStorage, setInStorage } from "../core/storage";
import { isBlacklisted, removeBlacklistEntry, type BlacklistEntry } from "../matching";
import { cloneBlacklistButton, watchShortlistButtonClass } from "./button";
import {
    getChildListingUrl,
    PROJECT_DETAILS_SELECTOR,
    PROJECT_MARKER_SELECTOR,
    SHORTLIST_BUTTON_SELECTOR,
} from "./card";
import { getSummary } from "./summary";
import { toggleBlacklist } from "./toggle";

const claimProjectCard = createClaimTracker<HTMLElement>();
const PROJECT_SUMMARY_SELECTOR = '[data-testid="listing-card-project-blacklist-summary"]';

function getProjectSummary(projectCard: HTMLElement, projectHeader: HTMLElement): HTMLElement {
    const existing = projectCard.querySelector<HTMLElement>(PROJECT_SUMMARY_SELECTOR);
    if (existing) return existing;

    const summary = document.createElement("div");
    const text = document.createElement("span");
    const button = document.createElement("button");
    const icon = document.createElementNS("http://www.w3.org/2000/svg", "svg");

    summary.className = "edf-blacklist-summary edf-project-blacklist-summary";
    summary.setAttribute("data-testid", "listing-card-project-blacklist-summary");

    text.className = "edf-blacklist-summary-text";
    text.setAttribute("data-testid", "listing-card-project-blacklist-summary-text");

    icon.setAttribute("aria-hidden", "true");
    icon.setAttribute("width", "18");
    icon.setAttribute("height", "18");
    replaceWithBinIcon(icon);

    button.type = "button";
    button.className = "edf-blacklist-summary-button";
    button.append(icon, "Unblacklist");

    summary.append(text, button);
    projectHeader.after(summary);

    return summary;
}

// Child listings within a project are hidden outright when blacklisted (no per-row collapsed
// bar) — instead a single aggregate summary on the project card itself surfaces how many are
// hidden and lets the user restore them all at once.
export function updateProjectBlacklistSummary(
    projectCard: HTMLElement,
    projectHeader: HTMLElement,
    blacklist: BlacklistEntry[],
): void {
    const children = [...projectCard.querySelectorAll<HTMLElement>('[data-testid="listing-card-child-listing"]')];
    const blacklistedUrls = children
        .map(child => ({ child, url: getChildListingUrl(child) }))
        .filter((entry): entry is { child: HTMLElement; url: string } =>
            entry.url !== undefined && isBlacklisted(blacklist, entry.url),
        );

    const blacklistedChildren = new Set(blacklistedUrls.map(entry => entry.child));
    for (const child of children) {
        child.hidden = blacklistedChildren.has(child);
    }

    if (blacklistedUrls.length === 0) {
        projectCard.querySelector(PROJECT_SUMMARY_SELECTOR)?.remove();
        return;
    }

    const summary = getProjectSummary(projectCard, projectHeader);
    const text = summary.querySelector<HTMLElement>('[data-testid="listing-card-project-blacklist-summary-text"]');
    if (text) {
        text.textContent = blacklistedUrls.length === 1
            ? "1 property blacklisted"
            : `${blacklistedUrls.length} properties blacklisted`;
    }

    const button = summary.querySelector<HTMLButtonElement>('.edf-blacklist-summary-button');
    if (button) {
        button.onclick = async event => {
            event.preventDefault();
            event.stopPropagation();

            const current = (await getFromStorage<BlacklistEntry[]>("blacklist")) ?? [];
            const next = blacklistedUrls.reduce(
                (entries, entry) => removeBlacklistEntry(entries, entry.url),
                current,
            );
            await setInStorage("blacklist", next);
        };
    }
}

// The details block is [title-div, address-span] — wrap the address in a flex row alongside
// the button so it reads as "address ... unblacklist icon" justified to opposite ends, instead
// of the old absolute-positioned overlay button sitting on top of the hero photo.
function insertProjectBlacklistButton(details: HTMLElement, button: HTMLButtonElement): void {
    const existingRow = details.querySelector(':scope > .edf-project-blacklist-row');
    if (existingRow) {
        existingRow.append(button);
        return;
    }

    const address = details.lastElementChild;
    if (!address) {
        details.append(button);
        return;
    }

    const row = document.createElement('div');
    row.className = 'edf-project-blacklist-row';
    address.replaceWith(row);
    row.append(address, button);
}

export function bindProjectCard(projectCard: HTMLElement, context: PageContext): void {
    if (!projectCard.querySelector(PROJECT_MARKER_SELECTOR)) return;

    const sourceButton = projectCard.querySelector<HTMLButtonElement>(SHORTLIST_BUTTON_SELECTOR);
    const details = projectCard.querySelector<HTMLElement>(PROJECT_DETAILS_SELECTOR);
    const url = projectCard.querySelector<HTMLAnchorElement>('a[href*="/project/"]')?.href;
    if (!sourceButton || !details || !url) return;
    if (!claimProjectCard(projectCard)) return;

    const button = cloneBlacklistButton(sourceButton);
    button.dataset.blacklistScope = "project";
    button.classList.add("edf-project-blacklist-button");
    insertProjectBlacklistButton(details, button);
    queueForegroundContrastSync(button, { scope: projectCard });
    watchShortlistButtonClass(sourceButton, button, context);

    getSummary(projectCard)
        .querySelector<HTMLButtonElement>('[data-testid="listing-card-blacklist-restore"]')
        ?.addEventListener("click", event => {
            event.preventDefault();
            event.stopPropagation();
            void toggleBlacklist(projectCard, url, context, sourceButton, button);
        });

    button.addEventListener("click", async event => {
        event.preventDefault();
        event.stopPropagation();
        await toggleBlacklist(projectCard, url, context, sourceButton, button);
    });
}
