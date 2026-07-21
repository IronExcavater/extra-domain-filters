export type PopupView = "filters" | "blacklist" | "preferences";

interface NavigationOptions {
    activeView: PopupView;
    onNavigate(view: PopupView): void;
}

function createNavigationButton(
    view: PopupView,
    label: string,
    options: NavigationOptions,
): HTMLButtonElement {
    const button = document.createElement("button");
    button.className = "edf-popup-navigation-button";
    button.type = "button";
    button.dataset.active = String(view === options.activeView);
    button.textContent = label;
    button.addEventListener("click", () => options.onNavigate(view));
    return button;
}

export function createNavigation(options: NavigationOptions): HTMLElement {
    const header = document.createElement("header");
    const brand = document.createElement("a");
    const wordmark = document.createElement("span");
    const label = document.createElement("span");
    const navigation = document.createElement("nav");
    const account = document.createElement("details");
    const summary = document.createElement("summary");
    const menu = document.createElement("div");

    header.className = "edf-popup-navigation";
    brand.className = "edf-popup-brand";
    brand.href = "https://www.domain.com.au/";
    brand.target = "_blank";
    brand.rel = "noreferrer";
    wordmark.className = "edf-popup-wordmark";
    wordmark.textContent = "domain";
    label.className = "edf-popup-brand-label";
    label.textContent = "Workspace";
    brand.append(wordmark, label);

    navigation.append(
        createNavigationButton("filters", "Filters", options),
        createNavigationButton("blacklist", "Blacklist", options),
    );

    account.className = "edf-popup-account";
    summary.className = "edf-popup-account-trigger";
    summary.textContent = "Account";
    menu.className = "edf-popup-account-menu";
    menu.append(createNavigationButton("preferences", "Preferences", options));
    account.append(summary, menu);
    header.append(brand, navigation, account);
    return header;
}
