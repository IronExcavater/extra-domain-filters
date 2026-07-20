import { getBlacklist } from "../../domain/blacklist/store";
import { PageContext } from "../../shared/platform/router";
import { getSettings } from "../../shared/state/settings";
import { cloneBlacklistButton, insertBlacklistButton, SHORTLIST_CARD_BUTTON_SKIN } from "./blacklist/button";
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

function bindBlacklistButton(
    shortlistButton: HTMLButtonElement,
    context: PageContext,
): void {
    const card = getCard(shortlistButton);
    if (!card) return;
    const kind = getBlacklistCardKind(card, shortlistButton);
    if (kind === "project-child" || kind === "carousel-child") return;

    const url = getListingUrl(shortlistButton, card);
    if (!url) return;
    if (shortlistButton.parentElement?.querySelector(".edf-blacklist-button")) return;

    const button = cloneBlacklistButton(shortlistButton, {
        skin: shortlistButton.closest("#shortlist")
            ? SHORTLIST_CARD_BUTTON_SKIN
            : { inactive: shortlistButton.className },
    });
    insertBlacklistButton(shortlistButton, button);

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
        bindBlacklistButton(shortlistButton, context);
    }

    const [settings, blacklist = []] = await Promise.all([
        getSettings(),
        getBlacklist(),
    ]);

    updateListingCards(settings, blacklist, showBlacklistedView);
}
