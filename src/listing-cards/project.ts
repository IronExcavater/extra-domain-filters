import { createClaimTracker } from "../core/claim";
import { queueForegroundContrastSync } from "../core/contrast";
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
import { getExclusionRow } from "./exclusion-row";
import { toggleBlacklist } from "./toggle";

const claimProjectCard = createClaimTracker<HTMLElement>();

// Reuses exclusion-row.ts's markup for the aggregate bar instead of building bespoke DOM, per
// the design spec — this sits on the project card itself (not per-child), right after the
// project header, since project children are hidden individually with one combined restore
// action rather than each getting their own row. getExclusionRow() itself prepends a freshly
// created row to the very start of the card, so this moves it into position right after
// (idempotent — a no-op once it's already there).
function getProjectAggregateRow(projectCard: HTMLElement, projectHeader: HTMLElement): HTMLElement {
    const row = getExclusionRow(projectCard);
    if (row.previousElementSibling !== projectHeader) {
        projectHeader.after(row);
    }
    return row;
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

    const existingRow = projectCard.querySelector('[data-testid="listing-card-exclusion-row"]');
    if (blacklistedUrls.length === 0) {
        existingRow?.remove();
        return;
    }

    const row = getProjectAggregateRow(projectCard, projectHeader);
    const text = row.querySelector<HTMLElement>('[data-testid="listing-card-exclusion-row-text"]');
    if (text) {
        text.textContent = blacklistedUrls.length === 1
            ? "1 property blacklisted"
            : `${blacklistedUrls.length} properties blacklisted`;
    }

    const button = row.querySelector<HTMLButtonElement>('[data-testid="listing-card-exclusion-restore"]');
    if (button) {
        button.lastChild!.textContent = "Unblacklist all";
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

    getExclusionRow(projectCard)
        .querySelector<HTMLButtonElement>('[data-testid="listing-card-exclusion-restore"]')
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
