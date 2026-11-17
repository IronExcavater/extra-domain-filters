import { parseProfileUrl, type BlacklistProfile, type ProfileKind } from "../../domain/blacklist/profiles";
import { addOrReplaceBlacklistEntry, removeBlacklistUrls } from "../../domain/blacklist/store";
import type { BlacklistEntry } from "../../domain/matching";
import { showToast, type ToastScope } from "../../ui/toast";

export const PROFILE_SECTION_TEST_ID = "extra-domain-filters-blacklist-profiles";

export interface ProfileEntry {
    entry: BlacklistEntry;
    profile: BlacklistProfile;
}

/** Blacklisted agencies and agents, newest first. */
export function getProfileEntries(entries: readonly BlacklistEntry[], kind?: ProfileKind): ProfileEntry[] {
    return entries
        .flatMap(entry => {
            const profile = entry.removedAt ? undefined : parseProfileUrl(entry.url, entry.displayAddress);
            return profile && (!kind || profile.kind === kind) ? [{ entry, profile }] : [];
        })
        .sort((first, second) => second.entry.addedAt - first.entry.addedAt);
}

function initials(name: string): string {
    return name.split(/\s+/).filter(Boolean).slice(0, 2).map(word => word[0]).join("").toUpperCase();
}

function formatAdded(addedAt: number): string {
    return `Hidden since ${new Date(addedAt).toLocaleDateString("en-AU", { day: "numeric", month: "short" })}`;
}

/** One blacklisted agency or agent: logo (or initials), name, since when, and a way back. */
export function createProfileCard(
    { entry, profile }: ProfileEntry,
    options: { openInNewTab?: boolean; toastScope?: ToastScope } = {},
): HTMLElement {
    const card = document.createElement("article");
    const avatar = document.createElement("span");
    const text = document.createElement("div");
    const name = document.createElement("a");
    const meta = document.createElement("span");
    const action = document.createElement("button");

    card.className = "edf-profile-card";
    card.dataset.kind = profile.kind;
    avatar.className = "edf-profile-card-avatar";
    avatar.ariaHidden = "true";
    if (entry.thumbnailUrl) {
        const logo = document.createElement("img");
        logo.alt = "";
        logo.loading = "lazy";
        logo.src = entry.thumbnailUrl;
        avatar.append(logo);
    } else {
        avatar.textContent = initials(profile.name);
    }
    text.className = "edf-profile-card-text";
    name.className = "edf-profile-card-name";
    name.href = profile.url;
    name.textContent = profile.name;
    if (options.openInNewTab) {
        name.target = "_blank";
        name.rel = "noopener noreferrer";
    }
    meta.className = "edf-profile-card-meta";
    meta.textContent = formatAdded(entry.addedAt);
    text.append(name, meta);
    action.type = "button";
    action.className = "edf-profile-card-action";
    action.textContent = "Show again";
    action.ariaLabel = `Show listings from ${profile.name} again`;
    action.addEventListener("click", async () => {
        action.disabled = true;
        card.dataset.removing = "true";
        await removeBlacklistUrls(entry.url);
        showToast(`Listings from ${profile.name} are shown again`, options.toastScope ?? "page", {
            action: {
                label: "Undo",
                onClick: () => addOrReplaceBlacklistEntry({
                    displayAddress: profile.name,
                    text: "",
                    thumbnailUrl: entry.thumbnailUrl,
                    title: profile.name,
                    url: entry.url,
                }),
            },
        });
    });
    card.append(avatar, text, action);
    return card;
}

/**
 * Domain's blacklist page: hidden agencies and agents as their own section above the hidden
 * listings. Undefined when there are none.
 */
export function createProfileSection(entries: readonly BlacklistEntry[]): HTMLElement | undefined {
    const profiles = getProfileEntries(entries);
    if (profiles.length === 0) return undefined;

    const section = document.createElement("section");
    const heading = document.createElement("h2");
    const count = document.createElement("span");
    const grid = document.createElement("div");
    section.className = "edf-profile-section";
    section.dataset.testid = PROFILE_SECTION_TEST_ID;
    heading.className = "edf-profile-section-heading";
    count.className = "edf-profile-section-count";
    count.textContent = String(profiles.length);
    heading.append("Agencies and agents", count);
    grid.className = "edf-profile-grid";
    grid.append(...profiles.map(profile => createProfileCard(profile)));
    section.append(heading, grid);
    return section;
}
