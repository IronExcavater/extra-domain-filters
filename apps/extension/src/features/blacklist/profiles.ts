import { parseProfileUrl, type BlacklistProfile, type ProfileKind } from "../../domain/blacklist/profiles";
import { addOrReplaceBlacklistEntry, removeBlacklistUrls } from "../../domain/blacklist/store";
import { getBlacklistListing, type BlacklistEntry } from "../../domain/matching";
import { showToast, type ToastScope } from "../../ui/toast";

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

/** How long an unblacklisted listing, agency or agent stays under Removed. */
const REMOVED_DAYS = 30;
const DAY_MS = 86_400_000;

/** What came off the blacklist in the last 30 days, the latest first. */
export function getRecentlyRemoved(entries: readonly BlacklistEntry[], now = Date.now()): BlacklistEntry[] {
    const since = now - REMOVED_DAYS * DAY_MS;
    return entries
        .filter(entry => entry.removedAt !== undefined && entry.removedAt >= since)
        .sort((first, second) => (second.removedAt ?? 0) - (first.removedAt ?? 0));
}

const KIND_LABELS: Record<ProfileKind | "property", string> = { agency: "Agency", agent: "Agent", property: "Property" };

/**
 * One removed entry, in the profile card's layout: its photo or logo, its name, what it is and
 * when it came off, and a button that hides it again.
 */
export function createRemovedCard(
    entry: BlacklistEntry,
    options: { openInNewTab?: boolean; toastScope?: ToastScope } = {},
): HTMLElement {
    const profile = parseProfileUrl(entry.url, entry.displayAddress);
    const listing = getBlacklistListing(entry);
    const kind = profile?.kind ?? "property";
    const title = profile?.name ?? listing.displayAddress ?? listing.title;
    const card = document.createElement("article");
    const avatar = document.createElement("span");
    const text = document.createElement("div");
    const name = document.createElement("a");
    const meta = document.createElement("span");
    const action = document.createElement("button");

    card.className = "edf-profile-card";
    card.dataset.kind = kind;
    avatar.className = "edf-profile-card-avatar";
    avatar.ariaHidden = "true";
    const image = listing.thumbnailUrl ?? entry.thumbnailUrl;
    if (image) {
        const thumbnail = document.createElement("img");
        thumbnail.alt = "";
        thumbnail.loading = "lazy";
        thumbnail.src = image;
        avatar.append(thumbnail);
    } else {
        avatar.textContent = initials(title);
    }
    text.className = "edf-profile-card-text";
    name.className = "edf-profile-card-name";
    name.href = profile?.url ?? listing.url;
    name.textContent = title;
    if (options.openInNewTab) {
        name.target = "_blank";
        name.rel = "noopener noreferrer";
    }
    meta.className = "edf-profile-card-meta";
    meta.textContent = `${KIND_LABELS[kind]}, removed ${new Date(entry.removedAt ?? Date.now())
        .toLocaleDateString("en-AU", { day: "numeric", month: "short" })}`;
    text.append(name, meta);
    action.type = "button";
    action.className = "edf-profile-card-action";
    action.textContent = "Blacklist again";
    action.ariaLabel = `Blacklist ${title} again`;
    action.addEventListener("click", async () => {
        action.disabled = true;
        card.dataset.removing = "true";
        await addOrReplaceBlacklistEntry(listing);
        showToast(`${title} is blacklisted again`, options.toastScope ?? "page", {
            action: { label: "Undo", onClick: () => removeBlacklistUrls(entry.url) },
        });
    });
    card.append(avatar, text, action);
    return card;
}

export const REMOVED_EMPTY_COPY = {
    title: "Nothing removed lately",
    description: "Listings, agencies and agents you unblacklist stay here for 30 days, so you can hide them again.",
};

/** Empty states for the blacklist's tabs, shared by the popup and Domain's blacklist page. */
export const PROPERTIES_EMPTY_COPY = {
    title: "No blacklisted properties",
    description: "Use the bin on any listing to hide it from your searches. It will show up here.",
};

export const PROFILE_EMPTY_COPY: Record<ProfileKind, { description: string; title: string }> = {
    agency: {
        title: "No blacklisted agencies",
        description: "Use the bin in a listing's agency strip, or on an agency's page, to hide all of its listings.",
    },
    agent: {
        title: "No blacklisted agents",
        description: "Use the bin in a listing's agency strip to hide every listing from one agent.",
    },
};
