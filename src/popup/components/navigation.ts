import wordmarkSvg from "../../../public/icons/brand/wordmark.svg?raw";
import { signOut } from "../../domain/account/client";
import type { AccountState } from "../../domain/account/model";
import { createButton, createSvgIcon, type IconRenderer } from "../../shared/ui/elements";
import {
    replaceWithBinIcon,
    replaceWithChevronIcon,
    replaceWithPopupCogIcon,
    replaceWithPopupDoorIcon,
    replaceWithPopupSavedSearchIcon,
    replaceWithPopupStarIcon,
} from "../../shared/ui/icons";
import type { PopupData, PopupView } from "../model";

interface NavigationOptions {
    activeView: PopupView;
    data: PopupData;
    onNavigate(view: PopupView): void;
    onSessionChange(): void;
}

const NAV_ITEMS = [
    { label: "My Searches", view: "saved-searches" },
    { label: "Blacklist", view: "blacklist" },
] satisfies Array<{ label: string; view: PopupView }>;

function parseWordmark(): SVGSVGElement {
    return new DOMParser()
        .parseFromString(wordmarkSvg, "image/svg+xml")
        .documentElement as unknown as SVGSVGElement;
}

function createAvatar(state: AccountState): HTMLElement {
    if (state.status === "signed-in" && state.profile?.photoUrl) {
        const image = document.createElement("img");
        image.className = "edf-popup-avatar";
        image.alt = "";
        image.src = state.profile.photoUrl;
        return image;
    }

    const avatar = document.createElement("span");
    avatar.className = "edf-popup-avatar edf-popup-avatar-fallback";
    avatar.textContent = (state.profile?.displayName ?? state.profile?.email ?? "E")
        .slice(0, 1)
        .toUpperCase();
    return avatar;
}

function createMenuItem(
    label: string,
    renderIcon: IconRenderer,
    onClick: () => void,
    count?: number,
): HTMLButtonElement {
    const button = createButton("", "edf-popup-account-menu-item");
    const text = document.createElement("span");

    text.textContent = label;
    button.append(createSvgIcon(renderIcon), text);
    if (count !== undefined) {
        const badge = document.createElement("span");
        badge.className = "edf-popup-account-menu-count";
        badge.textContent = String(count);
        button.append(badge);
    }
    button.addEventListener("click", onClick);

    return button;
}

function createIdentity(account: AccountState): HTMLElement | undefined {
    if (account.status !== "signed-in") return undefined;

    const card = document.createElement("div");
    const identity = document.createElement("div");
    const name = document.createElement("p");
    const email = document.createElement("p");

    card.className = "edf-popup-account-card";
    identity.className = "edf-popup-account-identity";
    name.className = "edf-popup-account-name";
    name.textContent = account.profile?.displayName ?? "Domain user";
    email.className = "edf-popup-account-email";
    email.textContent = account.profile?.email ?? "Signed in";
    identity.append(name, email);
    card.append(createAvatar(account), identity);

    return card;
}

export function createNavigation(options: NavigationOptions): HTMLElement {
    const { activeView, data, onNavigate, onSessionChange } = options;
    const header = document.createElement("header");
    const brand = createButton("", "edf-popup-brand");
    const logo = parseWordmark();
    const navigation = document.createElement("nav");
    const account = document.createElement("details");
    const summary = document.createElement("summary");
    const menu = document.createElement("div");
    const blacklistCount = data.blacklist.filter(entry => !entry.removedAt).length;
    const closeAndNavigate = (view: PopupView): void => {
        account.open = false;
        onNavigate(view);
    };

    header.className = "edf-popup-navigation";
    logo.classList.add("edf-popup-wordmark");
    brand.ariaLabel = "Extra Domain Filters";
    brand.append(logo);
    brand.addEventListener("click", () => onNavigate("saved-searches"));

    navigation.className = "edf-popup-primary-navigation";
    for (const item of NAV_ITEMS) {
        const button = createButton(item.label, "edf-popup-navigation-button");
        button.dataset.active = String(item.view === activeView);
        button.addEventListener("click", () => onNavigate(item.view));
        navigation.append(button);
    }

    account.className = "edf-popup-account";
    summary.className = "edf-popup-account-summary edf-popup-navigation-item";
    if (data.account?.status === "signed-in") {
        summary.append(createAvatar(data.account));
    } else {
        const label = document.createElement("span");
        label.className = "edf-popup-account-menu-label";
        label.textContent = "Menu";
        summary.append(label);
    }
    const chevron = document.createElement("span");
    const indicator = document.createElement("span");
    chevron.className = "edf-popup-chevron";
    indicator.className = "edf-popup-account-indicator";
    chevron.append(createSvgIcon(replaceWithChevronIcon));
    summary.append(chevron, indicator);

    menu.className = "edf-popup-account-menu";
    const identity = data.account ? createIdentity(data.account) : undefined;
    if (identity) menu.append(identity);
    menu.append(createMenuItem(
        "My searches",
        replaceWithPopupSavedSearchIcon,
        () => closeAndNavigate("saved-searches"),
        data.savedSearches.length,
    ));
    if (data.account?.status === "signed-in") {
        menu.append(createMenuItem("Shortlist", replaceWithPopupStarIcon, () => {
            void chrome.tabs.create({ url: "https://www.domain.com.au/user/shortlist" });
            account.open = false;
        }));
    }
    menu.append(
        createMenuItem(
            "Blacklist",
            replaceWithBinIcon,
            () => closeAndNavigate("blacklist"),
            blacklistCount,
        ),
        createMenuItem(
            "Preferences",
            replaceWithPopupCogIcon,
            () => closeAndNavigate("preferences"),
        ),
    );

    const signedIn = data.account?.status === "signed-in";
    const sessionLabel = signedIn ? "Sign out" : "Sign in";
    const session = createMenuItem(sessionLabel, replaceWithPopupDoorIcon, async () => {
        if (!signedIn) {
            closeAndNavigate("sign-in");
            return;
        }
        session.disabled = true;
        try {
            await signOut();
            account.open = false;
            onSessionChange();
        } finally {
            session.disabled = false;
        }
    });
    session.disabled = data.account?.status === "unavailable";
    menu.append(session);
    account.append(summary, menu);
    header.append(brand, navigation, account);

    return header;
}
