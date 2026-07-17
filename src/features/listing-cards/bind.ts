import { type BlacklistEntry } from "../../domain/matching";
import { createClaimTracker } from "../../shared/dom/claim";
import { PageContext } from "../../shared/platform/router";
import { getFromStorage } from "../../shared/platform/storage";
import { getSettings } from "../../shared/state/settings";
import { cloneBlacklistButton, insertBlacklistButton, watchShortlistButtonClass } from "./blacklist/button";
import { toggleBlacklist } from "./blacklist/toggle";
import { bindCarouselCard } from "./cards/carousel";
import { bindProjectCard } from "./cards/project";
import {
    getCard,
    getBlacklistCardKind,
    getListingUrl,
    PROJECT_CARD_SELECTOR,
    SHORTLIST_BUTTON_SELECTOR,
    TOPSPOT_CAROUSEL_SELECTOR,
} from "./dom/card";
import { updateListingCards } from "./update";

const claimShortlistButton = createClaimTracker<HTMLButtonElement>();

function bindBlacklistButton(
    shortlistButton: HTMLButtonElement,
    context: PageContext,
): void {
    const card = getCard(shortlistButton);
    if (!card) return;
    if (getBlacklistCardKind(card, shortlistButton) === "project-child") return;

    const url = getListingUrl(shortlistButton, card);
    if (!url) return;

    const button = cloneBlacklistButton(shortlistButton);
    insertBlacklistButton(shortlistButton, button);
    watchShortlistButtonClass(shortlistButton, button, context);

    button.addEventListener("click", async event => {
        event.preventDefault();
        event.stopPropagation();
        await toggleBlacklist(card, url, context, shortlistButton, button);
    });
}

export async function injectListingCards(
    context: PageContext,
    showBlacklistedView = true,
): Promise<void> {
    for (const projectCard of document.querySelectorAll<HTMLElement>(PROJECT_CARD_SELECTOR)) {
        bindProjectCard(projectCard, context);
    }

    for (const carouselCard of document.querySelectorAll<HTMLElement>(TOPSPOT_CAROUSEL_SELECTOR)) {
        bindCarouselCard(carouselCard, context);
    }

    for (const shortlistButton of document.querySelectorAll<HTMLButtonElement>(SHORTLIST_BUTTON_SELECTOR)) {
        if (!claimShortlistButton(shortlistButton)) continue;
        bindBlacklistButton(shortlistButton, context);
    }

    const [settings, blacklist = []] = await Promise.all([
        getSettings(),
        getFromStorage<BlacklistEntry[]>("blacklist"),
    ]);

    updateListingCards(settings, blacklist, showBlacklistedView);
}
