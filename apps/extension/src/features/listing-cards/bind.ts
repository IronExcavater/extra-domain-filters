import { getBlacklist, removeBlacklistUrls } from "../../domain/blacklist/store";
import { PageContext } from "../../platform/router";
import { consumeInternalShortlistRemoval, isShortlisted } from "../../site-dom/shortlist";
import { getSettings } from "../../state/settings";
import { createBlacklistAction } from "./actions/blacklistAction";
import { toggleBlacklist } from "./blacklist/toggle";
import {
    bindCarouselCard,
    disposeCarouselControls,
    disposeDetachedCarouselControls,
} from "./cards/carousel";
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
    // Project cards have one aggregate action bound before the native shortlist controls are
    // scanned. Treating the project's own shortlist trigger as a standard listing would add a
    // second blacklist button with different semantics and styling.
    if (card.querySelector(".edf-project-blacklist-button")) return;

    const url = getListingUrl(shortlistButton, card);
    if (!url) return;
    if (shortlistButton.parentElement?.querySelector('[data-testid="listing-card-blacklist"]')) return;

    const button = createBlacklistAction({
        active: false,
        appearance: shortlistButton.closest("#shortlist") ? "shortlist" : "card",
        onToggle: async action => {
            await toggleBlacklist(card, url, context, shortlistButton, action);
        },
        signal: context.signal,
        template: shortlistButton,
    });
    if (kind === "carousel-child") button.dataset.blacklistScope = "carousel-child";
    shortlistButton.parentElement?.classList.add("edf-listing-card-button-container");
    shortlistButton.after(button);

    shortlistButton.addEventListener("click", () => {
        if (consumeInternalShortlistRemoval(shortlistButton)) return;
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
            // Topspot/Slick repeats buttons across real and cloned slides. Those controls need
            // the URL from their own slide and are reconciled by bindCarouselCard below; the
            // generic card path otherwise resolves several clones to the carousel's first URL.
            if (shortlistButton.closest(TOPSPOT_CAROUSEL_SELECTOR)) continue;
            bindBlacklistButton(shortlistButton, context);
        }
    }

    if (settings.flags.enableCarouselControls || settings.flags.enableBlacklist) {
        for (const carouselCard of document.querySelectorAll<HTMLElement>(TOPSPOT_CAROUSEL_SELECTOR)) {
            bindCarouselCard(carouselCard, context, {
                enableBlacklist: settings.flags.enableBlacklist,
                enablePause: settings.flags.enableCarouselControls,
            });
        }
    } else {
        disposeCarouselControls();
    }

    await updateListingCards(settings, settings.flags.enableBlacklist ? blacklist : [], showBlacklistedView);
}
