import { isBlacklisted, type BlacklistEntry } from "../../../domain/matching";
import { PageContext } from "../../../shared/platform/router";
import { getBlacklistedBundleUrls, toggleBundleBlacklist, type BundleMember } from "../blacklist/bundle";
import { cloneBlacklistButton, updateButton } from "../clone/blacklistButton";
import {
    getChildListingUrl,
    getListingSnapshot,
    getTitle,
    PROJECT_DETAILS_SELECTOR,
    PROJECT_MARKER_SELECTOR,
    SHORTLIST_BUTTON_SELECTOR,
} from "../dom/card";
import { getExclusionRow, updateExclusionRow } from "../exclusion/row";

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
    const blacklistedChildren = children
        .map(child => ({ child, url: getChildListingUrl(child) }))
        .filter((entry): entry is { child: HTMLElement; url: string } =>
            entry.url !== undefined && isBlacklisted(blacklist, entry.url),
        );
    const members = getProjectMembers(projectCard);
    const blacklistedUrls = getBlacklistedBundleUrls(members, blacklist);

    const hiddenChildren = new Set(blacklistedChildren.map(entry => entry.child));
    for (const child of children) {
        const hidden = hiddenChildren.has(child);
        if (child.hidden !== hidden) child.hidden = hidden;
    }

    const bulkButton = projectCard.querySelector<HTMLButtonElement>('.edf-project-blacklist-button');
    if (bulkButton) {
        const color = getComputedStyle(projectHeader).color;
        if (bulkButton.style.getPropertyValue("--edf-project-foreground") !== color) {
            bulkButton.style.setProperty("--edf-project-foreground", color);
        }
        updateButton(
            bulkButton,
            blacklistedUrls.length > 0,
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
    updateExclusionRow(projectCard, blacklistedUrls, "blacklisted");
    if (text) {
        const label = blacklistedChildren.length === 1
            ? `Blacklisted: ${getTitle(blacklistedChildren[0].child)}`
            : `Blacklisted in ${getTitle(projectCard)}`;
        if (text.textContent !== label) text.textContent = label;
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
    void context;

    const sourceButton = projectCard.querySelector<HTMLButtonElement>(SHORTLIST_BUTTON_SELECTOR);
    const details = projectCard.querySelector<HTMLElement>(PROJECT_DETAILS_SELECTOR);
    if (!sourceButton || !details || !getProjectUrl(projectCard)) return;
    if (projectCard.querySelector(".edf-project-blacklist-button")) return;

    const button = cloneBlacklistButton(sourceButton, { appearance: "native" });
    button.dataset.blacklistScope = "project";
    button.classList.add("edf-project-blacklist-button");
    insertProjectBlacklistButton(details, button);

    button.addEventListener("click", async event => {
        event.preventDefault();
        event.stopPropagation();
        await toggleBundleBlacklist(getProjectMembers(projectCard));
    });
}
