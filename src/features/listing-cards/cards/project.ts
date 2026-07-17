import { addBlacklistEntry, isBlacklisted, removeBlacklistEntry, type BlacklistEntry } from "../../../domain/matching";
import { createClaimTracker } from "../../../shared/dom/claim";
import { queueForegroundContrastSync } from "../../../shared/dom/contrast";
import { PageContext } from "../../../shared/platform/router";
import { getFromStorage, setInStorage } from "../../../shared/platform/storage";
import { replaceWithUnbinIcon } from "../../../shared/ui/icons";
import { toggleBundleBlacklist, type BundleMember } from "../blacklist/bundle";
import { cloneBlacklistButton, updateButton, watchShortlistButtonClass } from "../blacklist/button";
import {
    getChildListingUrl,
    getListingSnapshot,
    PROJECT_DETAILS_SELECTOR,
    PROJECT_MARKER_SELECTOR,
    SHORTLIST_BUTTON_SELECTOR,
} from "../dom/card";
import { getExclusionRow } from "../exclusion/row";

const claimProjectCard = createClaimTracker<HTMLElement>();

function getProjectUrl(projectCard: HTMLElement): string | undefined {
    const anchor = projectCard.querySelector<HTMLAnchorElement>('a[href*="/project/"]');
    return anchor ? new URL(anchor.href, window.location.origin).href : undefined;
}

function getProjectMembers(projectCard: HTMLElement): BundleMember[] {
    const projectUrl = getProjectUrl(projectCard);
    const members = [...projectCard.querySelectorAll<HTMLElement>('[data-testid="listing-card-child-listing"]')]
        .map(child => {
            const url = getChildListingUrl(child);
            return url ? { url, snapshot: getListingSnapshot(child, url) } : undefined;
        })
        .filter((member): member is BundleMember => member !== undefined);

    if (projectUrl) {
        members.unshift({
            url: projectUrl,
            snapshot: getListingSnapshot(projectCard, projectUrl),
        });
    }

    return members;
}

async function ensureProjectEntryWhenAllChildrenBlacklisted(
    projectCard: HTMLElement,
    blacklist: BlacklistEntry[],
): Promise<void> {
    const projectUrl = getProjectUrl(projectCard);
    if (!projectUrl || isBlacklisted(blacklist, projectUrl)) return;

    const childUrls = [...projectCard.querySelectorAll<HTMLElement>('[data-testid="listing-card-child-listing"]')]
        .map(getChildListingUrl)
        .filter((url): url is string => url !== undefined);

    if (childUrls.length === 0 || !childUrls.every(url => isBlacklisted(blacklist, url))) return;

    await setInStorage(
        "blacklist",
        addBlacklistEntry(blacklist, getListingSnapshot(projectCard, projectUrl)),
    );
}

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
    void ensureProjectEntryWhenAllChildrenBlacklisted(projectCard, blacklist);

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

    const bulkButton = projectCard.querySelector<HTMLButtonElement>('.edf-project-blacklist-button');
    if (bulkButton) {
        updateButton(
            bulkButton,
            getProjectMembers(projectCard).some(member => isBlacklisted(blacklist, member.url)),
            "Blacklist project",
        );
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
        if (icon) replaceWithUnbinIcon(icon);
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
    if (!sourceButton || !details || !getProjectUrl(projectCard)) return;
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
        await toggleBundleBlacklist(getProjectMembers(projectCard));
    });
}
