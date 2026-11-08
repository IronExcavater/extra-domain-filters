import { isBlacklisted, type BlacklistEntry } from "../../../domain/matching";
import { PageContext } from "../../../platform/router";
import { createBlacklistAction, setBlacklistActionState } from "../actions/blacklistAction";
import { getBlacklistedBundleUrls, toggleBundleBlacklist, type BundleMember } from "../blacklist/bundle";
import {
    getChildListingUrl,
    getListingSnapshot,
    getTitle,
    PROJECT_CARD_SELECTOR,
    PROJECT_DETAILS_SELECTOR,
    PROJECT_MARKER_SELECTOR,
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

function isDarkBackground(element: HTMLElement): boolean {
    const rect = element.getBoundingClientRect();
    const overlapsImage = [...element.closest(PROJECT_CARD_SELECTOR)?.querySelectorAll("img") ?? []]
        .some(image => {
            const imageRect = image.getBoundingClientRect();
            const overlapWidth = Math.max(0, Math.min(rect.right, imageRect.right) - Math.max(rect.left, imageRect.left));
            const overlapHeight = Math.max(0, Math.min(rect.bottom, imageRect.bottom) - Math.max(rect.top, imageRect.top));
            return overlapWidth * overlapHeight > rect.width * rect.height * 0.35;
        });
    if (overlapsImage) return true;

    for (let current: HTMLElement | null = element; current; current = current.parentElement) {
        const match = getComputedStyle(current).backgroundColor.match(/rgba?\((\d+)\D+(\d+)\D+(\d+)(?:\D+([\d.]+))?/);
        if (!match || Number(match[4] ?? 1) === 0) continue;
        const luminance = (0.2126 * Number(match[1]) + 0.7152 * Number(match[2]) + 0.0722 * Number(match[3])) / 255;
        return luminance < 0.48;
    }
    return false;
}

function insertProjectBlacklistButton(
    projectCard: HTMLElement,
    button: HTMLButtonElement,
): void {
    projectCard.classList.add("edf-project-has-blacklist-action");
    projectCard.append(button);
}

export function bindProjectCard(projectCard: HTMLElement, context: PageContext): void {
    const marker = projectCard.querySelector<HTMLElement>(PROJECT_MARKER_SELECTOR);
    if (!marker) return;
    const details = projectCard.querySelector<HTMLElement>(PROJECT_DETAILS_SELECTOR) ?? marker;
    if (!getProjectUrl(projectCard)) return;
    if (projectCard.querySelector(".edf-project-blacklist-button")) return;

    const button = createBlacklistAction({
        active: false,
        appearance: "project",
        label: "Blacklist project",
        onToggle: () => toggleBundleBlacklist(getProjectMembers(projectCard)),
        signal: context.signal,
    });
    button.classList.add("edf-project-blacklist-button");
    insertProjectBlacklistButton(projectCard, button);
    // The action lives in the card's top branding header (the project logo bar), vertically
    // centred at its right edge; cards without a branding bar fall back to the details strip.
    const header = projectCard.querySelector<HTMLElement>('[data-testid="listing-card-project-branding"]') ?? details;
    projectCard.dataset.edfProjectActionHost = header === details ? "details" : "branding";
    const syncLayout = (): void => {
        const cardRect = projectCard.getBoundingClientRect();
        const headerRect = header.getBoundingClientRect();
        const buttonHeight = button.getBoundingClientRect().height || 28;
        button.style.top = `${Math.max(0, headerRect.top - cardRect.top + (headerRect.height - buttonHeight) / 2)}px`;
        button.dataset.contrast = isDarkBackground(header) ? "light" : "default";
    };
    const resizeObserver = new ResizeObserver(syncLayout);
    resizeObserver.observe(projectCard);
    resizeObserver.observe(header);
    requestAnimationFrame(syncLayout);
    context.signal.addEventListener("abort", () => resizeObserver.disconnect(), { once: true });
}
