import { PageMount } from "../core/router";
import { getSettings } from "../core/settings";
import { getFromStorage, onStorageChange, setInStorage } from "../core/storage";
import { resolveListingSnapshot } from "../listings/cache";
import {
    addBlacklistEntry,
    matchListing,
    removeBlacklistEntry,
    type BlacklistEntry,
} from "../matching";

function getAddress(): string {
    return document.querySelector("h1")?.textContent?.trim() || document.title;
}

async function updateButton(button: HTMLButtonElement, url: string): Promise<void> {
    const blacklist = (await getFromStorage<BlacklistEntry[]>("blacklist")) ?? [];
    const active = matchListing(
        { url, title: "", text: "" },
        await getSettings(),
        blacklist
    ).exclusionReason === "blacklisted";

    button.textContent = active ? "Remove from blacklist" : "Blacklist";
    button.dataset.active = String(active);
}

function insertButton(): HTMLButtonElement {
    const button = document.createElement("button");
    button.type = "button";
    button.setAttribute("data-testid", "listing-details__blacklist-button");
    button.style.marginLeft = "8px";
    button.textContent = "Blacklist";

    const shortlistButton = document.querySelector('[data-testid*="shortlist"]');
    if (shortlistButton?.parentElement) {
        shortlistButton.parentElement.append(button);
    } else {
        document.body.prepend(button);
    }

    return button;
}

const mountListingPage: PageMount = async (context) => {
    const url = context.url.href;
    const button = insertButton();

    button.addEventListener("click", async () => {
        const blacklist = (await getFromStorage<BlacklistEntry[]>("blacklist")) ?? [];
        const listing = await resolveListingSnapshot(
            {
                url,
                title: getAddress(),
                text: document.body.textContent ?? "",
                displayAddress: getAddress(),
                thumbnailUrl: document.querySelector<HTMLImageElement>("img")?.src,
            },
            { signal: context.signal, includeDetail: false }
        );
        const next = matchListing(listing, await getSettings(), blacklist).exclusionReason === "blacklisted"
            ? removeBlacklistEntry(blacklist, url)
            : addBlacklistEntry(blacklist, listing);

        await setInStorage("blacklist", next);
        await updateButton(button, url);
    });

    await updateButton(button, url);

    const unwatch = onStorageChange<BlacklistEntry[]>(
        "blacklist",
        () => void updateButton(button, url)
    );
    context.signal.addEventListener("abort", () => {
        unwatch();
        button.remove();
    }, { once: true });
};

export default mountListingPage;
