import "../features/settings/settings.css";
import "./popup.css";
import { getBlacklist, removeBlacklistUrls, setBlacklist } from "../domain/blacklist/store";
import { getBlacklistListing, type BlacklistEntry } from "../domain/matching";
import { createSettingsContent } from "../features/settings/view";
import { getSettings } from "../shared/state/settings";

type PopupView = "blacklist" | "preferences";

let activeView: PopupView = "preferences";

function createNavigation(): HTMLElement {
    const header = document.createElement("header");
    const brand = document.createElement("span");
    const navigation = document.createElement("nav");

    header.className = "edf-popup-navigation";
    brand.className = "edf-popup-brand";
    brand.textContent = "Extra Domain Filters";

    for (const view of ["preferences", "blacklist"] as const) {
        const button = document.createElement("button");
        button.className = "edf-popup-navigation-button";
        button.type = "button";
        button.dataset.active = String(view === activeView);
        button.textContent = view === "preferences" ? "Preferences" : "Blacklist";
        button.addEventListener("click", () => {
            activeView = view;
            void render();
        });
        navigation.append(button);
    }

    header.append(brand, navigation);
    return header;
}

function createBlacklistItem(entry: BlacklistEntry): HTMLElement {
    const listing = getBlacklistListing(entry);
    const item = document.createElement("article");
    const copy = document.createElement("div");
    const title = document.createElement("a");
    const detail = document.createElement("p");
    const restore = document.createElement("button");

    item.className = "edf-popup-blacklist-item";
    copy.className = "edf-popup-blacklist-copy";
    title.className = "edf-popup-blacklist-title";
    title.href = listing.url;
    title.target = "_blank";
    title.rel = "noreferrer";
    title.textContent = listing.displayAddress ?? listing.title;
    detail.className = "edf-popup-blacklist-detail";
    detail.textContent = listing.price ?? "Blacklisted property";
    restore.className = "edf-settings-action";
    restore.type = "button";
    restore.textContent = "Restore";
    restore.addEventListener("click", async () => {
        restore.disabled = true;
        await removeBlacklistUrls(listing.url);
        void render();
    });
    copy.append(title, detail);

    if (listing.thumbnailUrl) {
        const image = document.createElement("img");
        image.className = "edf-popup-blacklist-image";
        image.alt = "";
        image.src = listing.thumbnailUrl;
        item.append(image);
    }

    item.append(copy, restore);
    return item;
}

function createBlacklistContent(entries: BlacklistEntry[]): HTMLElement {
    const content = document.createElement("section");
    const heading = document.createElement("div");
    const title = document.createElement("h1");
    const description = document.createElement("p");

    content.className = "edf-popup-content edf-popup-blacklist";
    heading.className = "edf-settings-introduction";
    title.className = "edf-settings-title";
    title.textContent = "Blacklist";
    description.className = "edf-settings-description";
    description.textContent = "Manage properties hidden by Extra Domain Filters.";
    heading.append(title, description);
    content.append(heading);

    const activeEntries = entries.filter(entry => !entry.removedAt);
    if (activeEntries.length === 0) {
        const empty = document.createElement("div");
        empty.className = "edf-popup-empty-state";
        empty.textContent = "No blacklisted properties.";
        content.append(empty);
        return content;
    }

    const actions = document.createElement("div");
    const clear = document.createElement("button");
    actions.className = "edf-popup-blacklist-actions";
    clear.className = "edf-settings-action";
    clear.type = "button";
    clear.textContent = "Clear blacklist";
    clear.addEventListener("click", async () => {
        clear.disabled = true;
        await setBlacklist([]);
        void render();
    });
    actions.append(clear);
    content.append(actions);

    const list = document.createElement("div");
    list.className = "edf-popup-blacklist-list";
    list.append(...activeEntries.map(createBlacklistItem));
    content.append(list);
    return content;
}

async function render(): Promise<void> {
    const root = document.querySelector<HTMLElement>("#app");
    if (!root) return;

    const shell = document.createElement("main");
    shell.className = "edf-settings-popup";
    shell.append(createNavigation());

    if (activeView === "preferences") {
        const content = document.createElement("section");
        content.className = "edf-popup-content";
        content.append(createSettingsContent(await getSettings(), {
            sectionHeading: "h2",
            titleHeading: "h1",
        }));
        shell.append(content);
    } else {
        shell.append(createBlacklistContent(await getBlacklist()));
    }

    root.replaceChildren(shell);
}

void render();
