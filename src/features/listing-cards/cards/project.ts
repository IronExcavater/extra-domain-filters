import { createClaimTracker } from "../../../core/claim";
import { queueForegroundContrastSync } from "../../../core/contrast";
import { replaceWithBinIcon } from "../../../core/icons";
import { PageContext } from "../../../core/router";
import { getFromStorage, setInStorage } from "../../../core/storage";
import { isBlacklisted, removeBlacklistEntry, type BlacklistEntry } from "../../../matching";
import { cloneBlacklistButton, watchShortlistButtonClass } from "../blacklist/button";
import { toggleBlacklist } from "../blacklist/toggle";
import {
    getChildListingUrl,
    PROJECT_DETAILS_SELECTOR,
    PROJECT_MARKER_SELECTOR,
    SHORTLIST_BUTTON_SELECTOR,
} from "../dom/card";
import { getExclusionRow } from "../exclusion/row";

const claimProjectCard = createClaimTracker<HTMLElement>();

function getProjectAggregateRow(projectCard: HTMLElement, projectHeader: HTMLElement): HTMLElement {
    const row = getExclusionRow(projectCard);
    if (row.previousElementSibling !== projectHeader) {
        projectHeader.after(row);
    }
    return row;
}

export function updateProjectBlacklistSummary(
    projectCard: HTMLElement,
    projectHeader: HTMLElement,
    blacklist: BlacklistEntry[],
    projectExcluded: boolean,
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

    if (projectExcluded) return;

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
        const icon = button.querySelector("svg");
        if (icon) replaceWithBinIcon(icon);
        button.lastChild!.textContent = "Unblacklist all";
        button.ariaLabel = "Unblacklist all";
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

    button.addEventListener("click", async event => {
        event.preventDefault();
        event.stopPropagation();
        await toggleBlacklist(projectCard, url, context, sourceButton, button);
    });
}
