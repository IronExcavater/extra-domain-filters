import { getBlacklist, removeBlacklistUrls } from "../../domain/blacklist/store";
import { isShortlisted } from "../../shared/domain/shortlist";
import { PageContext } from "../../shared/platform/router";
import { getSettings } from "../../shared/state/settings";
import { createBlacklistAction } from "./actions/blacklistAction";
import { toggleBlacklist } from "./blacklist/toggle";
import { bindCarouselCard, disposeDetachedCarouselControls } from "./cards/carousel";
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
    if (kind === "project-child") return;

    const url = getListingUrl(shortlistButton, card);
    if (!url) return;
    if (shortlistButton.parentElement?.querySelector(".edf-blacklist-action")) return;

    const button = createBlacklistAction({
        active: false,
        appearance: shortlistButton.closest("#shortlist") ? "shortlist" : "card",
        onToggle: async action => {
            await toggleBlacklist(card, url, context, shortlistButton, action);
        },
        signal: context.signal,
    });
    if (kind === "carousel-child") button.dataset.blacklistScope = "carousel-child";
    shortlistButton.parentElement?.classList.add("edf-listing-card-button-container");
    shortlistButton.after(button);

    shortlistButton.addEventListener("click", () => {
        requestAnimationFrame(async () => {
            if (!isShortlisted(shortlistButton)) return;

            const blacklist = await getBlacklist();
            if (blacklist.some(entry => entry.url.replace(/\/$/, "") === url.replace(/\/$/, "") && !entry.removedAt)) {
                await removeBlacklistUrls(url);
            }
        });
    }, { signal: context.signal });
}

export async function injectListingCards(
    context: PageContext,
    showBlacklistedView = true,
): Promise<void> {
    disposeDetachedCarouselControls();
    const [settings, blacklist = []] = await Promise.all([
        getSettings(),
        getBlacklist(),
    ]);

    if (settings.flags.enableBlacklist) {
        for (const projectCard of document.querySelectorAll<HTMLElement>(PROJECT_CARD_SELECTOR)) {
            bindProjectCard(projectCard, context);
        }

        for (const shortlistButton of document.querySelectorAll<HTMLButtonElement>(SHORTLIST_BUTTON_SELECTOR)) {
            bindBlacklistButton(shortlistButton, context);
        }
    }

    if (settings.flags.enableCarouselControls) {
        for (const carouselCard of document.querySelectorAll<HTMLElement>(TOPSPOT_CAROUSEL_SELECTOR)) {
            bindCarouselCard(carouselCard, context, { enableBlacklist: settings.flags.enableBlacklist });
        }
    }

    await updateListingCards(settings, settings.flags.enableBlacklist ? blacklist : [], showBlacklistedView);
}
