import { getBlacklist, toggleBlacklistListing } from "../domain/blacklist/store";
import { getBlacklistListing, type BlacklistEntry } from "../domain/matching";
import { replaceWithBathIcon, replaceWithBedIcon, replaceWithBinIcon, replaceWithParkingIcon } from "../shared/ui/icons";

export type PopupSort = "recent" | "price" | "address";

interface BlacklistOptions {
    selectedUrls: Set<string>;
    sort: PopupSort;
    onSelectionChange(): void;
    onSortChange(sort: PopupSort): void;
    onChanged(): void;
}

function createIcon(icon: (target: SVGElement) => void, value: string): HTMLElement {
    const item = document.createElement("span");
    const svg = document.createElementNS("http://www.w3.org/2000/svg", "svg");
    icon(svg);
    item.append(svg, document.createTextNode(value));
    return item;
}

function createFeatureSummary(entry: BlacklistEntry): HTMLElement | undefined {
    const features = getBlacklistListing(entry).features;
    const values = [
        features?.bedrooms ? [replaceWithBedIcon, features.bedrooms] as const : undefined,
        features?.bathrooms ? [replaceWithBathIcon, features.bathrooms] as const : undefined,
        features?.parking ? [replaceWithParkingIcon, features.parking] as const : undefined,
    ].filter((value): value is readonly [(target: SVGElement) => void, string] => value !== undefined);
    if (values.length === 0) return undefined;

    const summary = document.createElement("p");
    summary.className = "edf-popup-card-features";
    summary.append(...values.map(([icon, value]) => createIcon(icon, value)));
    return summary;
}

function createSelectionControl(url: string, options: BlacklistOptions): HTMLLabelElement {
    const label = document.createElement("label");
    const input = document.createElement("input");

    label.className = "edf-popup-selection";
    input.type = "checkbox";
    input.checked = options.selectedUrls.has(url);
    input.ariaLabel = "Select blacklisted property";
    input.addEventListener("click", event => event.stopPropagation());
    input.addEventListener("change", () => {
        if (input.checked) options.selectedUrls.add(url);
        else options.selectedUrls.delete(url);
        options.onSelectionChange();
    });
    label.append(input);
    return label;
}

function createBlacklistButton(entry: BlacklistEntry, options: BlacklistOptions): HTMLButtonElement {
    const listing = getBlacklistListing(entry);
    const button = document.createElement("button");
    const icon = document.createElementNS("http://www.w3.org/2000/svg", "svg");

    button.className = "edf-popup-card-blacklist";
    button.type = "button";
    button.title = "Remove from blacklist";
    button.ariaLabel = "Remove from blacklist";
    replaceWithBinIcon(icon);
    button.append(icon);
    button.addEventListener("click", async () => {
        button.disabled = true;
        await toggleBlacklistListing(listing);
        options.selectedUrls.delete(listing.url);
        options.onChanged();
    });
    return button;
}

function createBlacklistCard(entry: BlacklistEntry, options: BlacklistOptions): HTMLElement {
    const listing = getBlacklistListing(entry);
    const card = document.createElement("article");
    const media = document.createElement("a");
    const body = document.createElement("div");
    const priceLine = document.createElement("div");
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
    priceLine.className = "edf-popup-card-price-line";
    price.className = "edf-popup-card-price";
    price.textContent = listing.price ?? listing.title;
    address.className = "edf-popup-card-address";
    address.href = listing.url;
    address.target = "_blank";
    address.rel = "noreferrer";
    address.textContent = listing.displayAddress ?? listing.title;
    priceLine.append(createSelectionControl(listing.url, options), price, createBlacklistButton(entry, options));
    body.append(priceLine, address);
    const features = createFeatureSummary(entry);
    if (features) body.append(features);
    card.append(media, body);
    return card;
}

function sortEntries(entries: BlacklistEntry[], sort: PopupSort): BlacklistEntry[] {
    return [...entries].sort((first, second) => {
        const firstListing = getBlacklistListing(first);
        const secondListing = getBlacklistListing(second);
        if (sort === "recent") return second.addedAt - first.addedAt;
        if (sort === "address") return (firstListing.displayAddress ?? firstListing.title)
            .localeCompare(secondListing.displayAddress ?? secondListing.title);
        return (firstListing.price ?? "").localeCompare(secondListing.price ?? "", undefined, { numeric: true });
    });
}

function createControls(entries: BlacklistEntry[], options: BlacklistOptions): HTMLElement {
    const controls = document.createElement("div");
    const select = document.createElement("button");
    const unblacklist = document.createElement("button");
    const sort = document.createElement("label");
    const selectInput = document.createElement("select");
    const urls = entries.map(entry => getBlacklistListing(entry).url);
    const allSelected = urls.length > 0 && urls.every(url => options.selectedUrls.has(url));

    controls.className = "edf-popup-blacklist-controls";
    select.className = "edf-settings-action";
    select.type = "button";
    select.textContent = allSelected ? "Deselect all" : "Select all";
    select.addEventListener("click", () => {
        if (allSelected) options.selectedUrls.clear();
        else urls.forEach(url => options.selectedUrls.add(url));
        options.onSelectionChange();
    });

    unblacklist.className = "edf-settings-action";
    unblacklist.type = "button";
    unblacklist.hidden = options.selectedUrls.size === 0;
    unblacklist.textContent = "Unblacklist selection";
    unblacklist.addEventListener("click", async () => {
        const selected = entries.filter(entry => options.selectedUrls.has(getBlacklistListing(entry).url));
        await Promise.all(selected.map(entry => toggleBlacklistListing(getBlacklistListing(entry))));
        options.selectedUrls.clear();
        options.onChanged();
    });

    sort.className = "edf-popup-sort";
    sort.textContent = "Sort by";
    selectInput.value = options.sort;
    for (const [value, label] of [["recent", "Recently blacklisted"], ["price", "Price"], ["address", "Address"]] as const) {
        const option = new Option(label, value);
        selectInput.append(option);
    }
    selectInput.addEventListener("change", () => options.onSortChange(selectInput.value as PopupSort));
    sort.append(selectInput);
    controls.append(select, unblacklist, sort);
    return controls;
}

export async function createBlacklistContent(options: BlacklistOptions): Promise<HTMLElement> {
    const entries = (await getBlacklist()).filter(entry => !entry.removedAt);
    const content = document.createElement("section");
    const header = document.createElement("div");
    const title = document.createElement("h1");
    const description = document.createElement("p");

    content.className = "edf-popup-content edf-popup-blacklist";
    header.className = "edf-popup-view-header";
    title.className = "edf-popup-view-title";
    title.textContent = "Blacklisted properties";
    description.className = "edf-popup-view-description";
    description.textContent = entries.length === 1 ? "1 property excluded from search results" : `${entries.length} properties excluded from search results`;
    header.append(title, description);
    content.append(header);

    if (entries.length === 0) {
        const empty = document.createElement("div");
        empty.className = "edf-popup-empty-state";
        empty.textContent = "No blacklisted properties.";
        content.append(empty);
        return content;
    }

    content.append(createControls(entries, options));
    const grid = document.createElement("div");
    grid.className = "edf-popup-blacklist-grid";
    grid.append(...sortEntries(entries, options.sort).map(entry => createBlacklistCard(entry, options)));
    content.append(grid);
    return content;
}
