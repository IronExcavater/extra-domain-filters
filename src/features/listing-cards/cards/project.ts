import { isBlacklisted, type BlacklistEntry } from "../../../domain/matching";
import { PageContext } from "../../../shared/platform/router";
import { createBlacklistAction, setBlacklistActionState } from "../actions/blacklistAction";
import { getBlacklistedBundleUrls, toggleBundleBlacklist, type BundleMember } from "../blacklist/bundle";
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

function getVisibleTextElement(container: HTMLElement): HTMLElement | undefined {
    return [...container.querySelectorAll<HTMLElement>("h1, h2, h3, a, span, p"), container]
        .find(element =>
            !element.classList.contains("edf-project-blacklist-button") &&
            element.textContent?.trim() &&
            element.getClientRects().length > 0,
        );
}

function getProjectTextColor(projectHeader: HTMLElement, details: HTMLElement | null): string {
    const textElement = getVisibleTextElement(details ?? projectHeader) ??
        getVisibleTextElement(projectHeader) ??
        projectHeader;

    return getComputedStyle(textElement).color;
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
        const color = getProjectTextColor(
            projectHeader,
            projectCard.querySelector<HTMLElement>(PROJECT_DETAILS_SELECTOR),
        );
        if (bulkButton.style.getPropertyValue("--edf-project-foreground") !== color) {
            bulkButton.style.setProperty("--edf-project-foreground", color);
        }
        setBlacklistActionState(bulkButton, {
            active: blacklistedUrls.length > 0,
            label: "Blacklist project",
        });
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
    if (details.querySelector(':scope > .edf-project-blacklist-button')) return;

    const address = details.lastElementChild;
    if (!address) {
        details.append(button);
        return;
    }

    if (address instanceof HTMLAnchorElement) {
        address.after(button);
        return;
    }

    address.append(button);
}

export function bindProjectCard(projectCard: HTMLElement, context: PageContext): void {
    if (!projectCard.querySelector(PROJECT_MARKER_SELECTOR)) return;
    const sourceButton = projectCard.querySelector<HTMLButtonElement>(SHORTLIST_BUTTON_SELECTOR);
    const details = projectCard.querySelector<HTMLElement>(PROJECT_DETAILS_SELECTOR);
    if (!sourceButton || !details || !getProjectUrl(projectCard)) return;
    if (projectCard.querySelector(".edf-project-blacklist-button")) return;

    const button = createBlacklistAction({
        active: false,
        appearance: "project",
        label: "Blacklist project",
        onToggle: () => toggleBundleBlacklist(getProjectMembers(projectCard)),
        signal: context.signal,
    });
    button.classList.add("edf-project-blacklist-button");
    insertProjectBlacklistButton(details, button);
}
