import { getBlacklistedProfiles, type BlacklistProfile } from "../../domain/blacklist/profiles";
import { removeBlacklistUrls } from "../../domain/blacklist/store";
import type { BlacklistEntry } from "../../domain/matching";
import { createSvgIcon } from "../../ui/elements";
import { replaceWithCloseIcon } from "../../ui/icons";

export const PROFILE_STRIP_TEST_ID = "extra-domain-filters-blacklist-profiles";

function createChip(profile: BlacklistProfile, openInNewTab: boolean): HTMLElement {
    const chip = document.createElement("span");
    const link = document.createElement("a");
    const kind = document.createElement("span");
    const remove = document.createElement("button");

    chip.className = "edf-blacklist-profile";
    link.className = "edf-blacklist-profile-name";
    link.href = profile.url;
    link.textContent = profile.name;
    if (openInNewTab) link.target = "_blank";
    kind.className = "edf-blacklist-profile-kind";
    kind.textContent = profile.kind === "agency" ? "Agency" : "Agent";
    remove.type = "button";
    remove.className = "edf-blacklist-profile-remove";
    remove.ariaLabel = `Unblacklist ${profile.name}`;
    remove.append(createSvgIcon(replaceWithCloseIcon, "edf-blacklist-profile-remove-icon"));
    remove.addEventListener("click", () => {
        remove.disabled = true;
        void removeBlacklistUrls(profile.url);
    });
    chip.append(link, kind, remove);
    return chip;
}

/**
 * Blacklisted agencies and agents, shown above the blacklisted listings as removable chips.
 * Returns undefined when there are none.
 */
export function createProfileStrip(
    entries: readonly BlacklistEntry[],
    options: { openInNewTab?: boolean } = {},
): HTMLElement | undefined {
    const profiles = getBlacklistedProfiles(entries);
    if (profiles.length === 0) return undefined;

    const strip = document.createElement("section");
    const heading = document.createElement("h2");
    const chips = document.createElement("div");

    strip.className = "edf-blacklist-profiles";
    strip.dataset.testid = PROFILE_STRIP_TEST_ID;
    heading.className = "edf-blacklist-profiles-heading";
    heading.textContent = "Hidden agencies & agents";
    chips.className = "edf-blacklist-profiles-chips";
    chips.append(...[...profiles]
        .sort((first, second) => first.kind.localeCompare(second.kind) || first.name.localeCompare(second.name))
        .map(profile => createChip(profile, options.openInNewTab ?? false)));
    strip.append(heading, chips);
    return strip;
}
