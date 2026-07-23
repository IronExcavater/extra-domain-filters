export function createCollectionHeader(
    titleText: string,
    descriptionText: string,
): HTMLElement {
    const header = document.createElement("div");
    const title = document.createElement("h1");
    const description = document.createElement("p");

    header.className = "edf-collection-header";
    title.className = "edf-collection-title";
    title.textContent = titleText;
    description.className = "edf-collection-description";
    description.textContent = descriptionText;
    header.append(title, description);

    return header;
}

export function createEmptyState(
    titleText: string,
    descriptionText: string,
): HTMLElement {
    const empty = document.createElement("div");
    const title = document.createElement("p");
    const description = document.createElement("p");

    empty.className = "edf-empty-state";
    title.className = "edf-empty-state-title";
    title.textContent = titleText;
    description.className = "edf-empty-state-description";
    description.textContent = descriptionText;
    empty.append(title, description);

    return empty;
}
