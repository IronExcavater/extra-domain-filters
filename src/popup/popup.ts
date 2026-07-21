import "../features/settings/settings.css";
import "./popup.css";
import { getBlacklist, removeBlacklistUrls, setBlacklist } from "../domain/blacklist/store";
import { getBlacklistListing, type BlacklistEntry } from "../domain/matching";
import { createSettingsContent } from "../features/settings/view";
import { getSettings } from "../shared/state/settings";
import { replaceWithUnbinIcon } from "../shared/ui/icons";

type PopupView = "blacklist" | "preferences";

const selectedUrls = new Set<string>();
let activeView: PopupView = "preferences";

function createNavigation(): HTMLElement {
    const header = document.createElement("header");
    const brand = document.createElement("div");
    const wordmark = document.createElement("span");
    const label = document.createElement("span");
    const navigation = document.createElement("nav");

    header.className = "edf-popup-navigation";
    brand.className = "edf-popup-brand";
    wordmark.className = "edf-popup-wordmark";
    wordmark.textContent = "domain";
    label.className = "edf-popup-brand-label";
    label.textContent = "Filters";
    brand.append(wordmark, label);

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

function createSelectionControl(url: string): HTMLLabelElement {
    const label = document.createElement("label");
    const input = document.createElement("input");

    label.className = "edf-popup-selection";
    input.type = "checkbox";
    input.checked = selectedUrls.has(url);
    input.ariaLabel = "Select blacklisted property";
    input.addEventListener("change", () => {
        if (input.checked) selectedUrls.add(url);
        else selectedUrls.delete(url);
        void render();
    });
    label.append(input);
    return label;
}

function createFeatureSummary(entry: BlacklistEntry): HTMLElement | undefined {
    const features = getBlacklistListing(entry).features;
    const values = [
        features?.bedrooms ? `${features.bedrooms} bed` : undefined,
        features?.bathrooms ? `${features.bathrooms} bath` : undefined,
        features?.parking ? `${features.parking} park` : undefined,
    ].filter((value): value is string => value !== undefined);
    if (values.length === 0) return undefined;

    const summary = document.createElement("p");
    summary.className = "edf-popup-card-features";
    summary.textContent = values.join("  ");
    return summary;
}

function createRestoreButton(url: string): HTMLButtonElement {
    const button = document.createElement("button");
    const icon = document.createElementNS("http://www.w3.org/2000/svg", "svg");

    button.className = "edf-popup-card-restore";
    button.type = "button";
    button.title = "Restore property";
    button.ariaLabel = "Restore property";
    replaceWithUnbinIcon(icon);
    button.append(icon);
    button.addEventListener("click", async () => {
        button.disabled = true;
        await removeBlacklistUrls(url);
        selectedUrls.delete(url);
        void render();
    });
    return button;
}

function createBlacklistCard(entry: BlacklistEntry): HTMLElement {
    const listing = getBlacklistListing(entry);
    const card = document.createElement("article");
    const media = document.createElement("a");
    const body = document.createElement("div");
    const actions = document.createElement("div");
    const price = document.createElement("p");
    const address = document.createElement("a");

    card.className = "edf-popup-blacklist-card";
    media.className = "edf-popup-card-media";
    media.href = listing.url;
    media.target = "_blank";
    media.rel = "noreferrer";
    if (listing.thumbnailUrl) {
        const image = document.createElement("img");
        image.alt = "";
        image.src = listing.thumbnailUrl;
        media.append(image);
    } else {
        media.classList.add("edf-popup-card-media-empty");
    }

    body.className = "edf-popup-card-body";
    actions.className = "edf-popup-card-actions";
    price.className = "edf-popup-card-price";
    price.textContent = listing.price ?? listing.title;
    address.className = "edf-popup-card-address";
    address.href = listing.url;
    address.target = "_blank";
    address.rel = "noreferrer";
    address.textContent = listing.displayAddress ?? listing.title;
    actions.append(createSelectionControl(listing.url), createRestoreButton(listing.url));
    body.append(actions, price, address);
    const features = createFeatureSummary(entry);
    if (features) body.append(features);
    card.append(media, body);
    return card;
}

function createBlacklistControls(entries: BlacklistEntry[]): HTMLElement {
    const controls = document.createElement("div");
    const select = document.createElement("button");
    const restore = document.createElement("button");
    const clear = document.createElement("button");
    const urls = entries.map(entry => getBlacklistListing(entry).url);
    const allSelected = urls.length > 0 && urls.every(url => selectedUrls.has(url));

    controls.className = "edf-popup-blacklist-controls";
    select.className = "edf-settings-action";
    select.type = "button";
    select.textContent = allSelected ? "Deselect all" : "Select all";
    select.addEventListener("click", () => {
        if (allSelected) selectedUrls.clear();
        else urls.forEach(url => selectedUrls.add(url));
        void render();
    });

    restore.className = "edf-settings-action";
    restore.type = "button";
    restore.textContent = "Restore selected";
    restore.hidden = selectedUrls.size === 0;
    restore.addEventListener("click", async () => {
        await removeBlacklistUrls([...selectedUrls]);
        selectedUrls.clear();
        void render();
    });

    clear.className = "edf-settings-action";
    clear.type = "button";
    clear.textContent = "Clear blacklist";
    clear.addEventListener("click", async () => {
        await setBlacklist([]);
        selectedUrls.clear();
        void render();
    });
    controls.append(select, restore, clear);
    return controls;
}

function createBlacklistContent(entries: BlacklistEntry[]): HTMLElement {
    const content = document.createElement("section");
    const header = document.createElement("div");
    const title = document.createElement("h1");
    const description = document.createElement("p");
    const activeEntries = entries.filter(entry => !entry.removedAt);

    content.className = "edf-popup-content edf-popup-blacklist";
    header.className = "edf-popup-view-header";
    title.className = "edf-popup-view-title";
    title.textContent = "Blacklisted properties";
    description.className = "edf-popup-view-description";
    description.textContent = activeEntries.length === 1
        ? "1 property excluded from search results"
        : `${activeEntries.length} properties excluded from search results`;
    header.append(title, description);
    content.append(header);

    if (activeEntries.length === 0) {
        const empty = document.createElement("div");
        empty.className = "edf-popup-empty-state";
        empty.textContent = "No blacklisted properties.";
        content.append(empty);
        return content;
    }

    content.append(createBlacklistControls(activeEntries));
    const grid = document.createElement("div");
    grid.className = "edf-popup-blacklist-grid";
    grid.append(...activeEntries.map(createBlacklistCard));
    content.append(grid);
    return content;
}

async function render(): Promise<void> {
    const root = document.querySelector<HTMLElement>("#app");
    if (!root) return;

    const shell = document.createElement("main");
    const content = document.createElement("section");
    shell.className = "edf-settings-popup";
    content.className = "edf-popup-content";
    shell.append(createNavigation());

    if (activeView === "preferences") {
        content.append(createSettingsContent(await getSettings(), {
            includeIntroduction: false,
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
