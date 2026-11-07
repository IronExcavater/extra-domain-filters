import wordmarkUrl from "../../../../../packages/assets/icons/brand/wordmark.svg?url";
import { signOut } from "../../domain/account/client";
import type { AccountState } from "../../domain/account/model";
import { createButton, createSvgIcon, type IconRenderer } from "../../ui/elements";
import {
    replaceWithBinIcon,
    replaceWithPopupCogIcon,
    replaceWithPopupDoorIcon,
    replaceWithPopupSavedSearchIcon,
    replaceWithPopupStarIcon,
} from "../../ui/icons";
import type { PopupData, PopupView } from "../model";
import { showPopupToast } from "../toast";

interface NavigationOptions {
    activeView: PopupView;
    data: PopupData;
    onNavigate(view: PopupView): void;
    onSessionChange(): void;
    signal: AbortSignal;
}

const NAV_ITEMS = [
    { label: "My Searches", view: "saved-searches" },
    { label: "Blacklist", view: "blacklist" },
] satisfies Array<{ label: string; view: PopupView }>;
let previousPrimaryView: PopupView | undefined;

function placePrimaryIndicator(
    navigation: HTMLElement,
    indicator: HTMLElement,
    activeView: PopupView,
): void {
    const buttons = [...navigation.querySelectorAll<HTMLButtonElement>("[data-popup-view]")];
    const active = buttons.find(button => button.dataset.popupView === activeView);
    if (!active) {
        indicator.dataset.visible = "false";
        return;
    }

    const previous = buttons.find(button => button.dataset.popupView === previousPrimaryView);
    const place = (button: HTMLButtonElement): void => {
        indicator.style.transform = `translateX(${button.offsetLeft}px)`;
        indicator.style.width = `${button.offsetWidth}px`;
    };

    indicator.dataset.visible = "true";
    if (previous && previous !== active) {
        indicator.dataset.instant = "true";
        place(previous);
        void indicator.offsetWidth;
        delete indicator.dataset.instant;
        requestAnimationFrame(() => {
            if (indicator.isConnected) place(active);
        });
    } else {
        indicator.dataset.instant = "true";
        place(active);
        requestAnimationFrame(() => delete indicator.dataset.instant);
    }
    previousPrimaryView = activeView;
}

function renderMenuIcon(icon: SVGElement): void {
    icon.setAttribute("viewBox", "0 0 24 24");
    icon.setAttribute("aria-hidden", "true");
    icon.replaceChildren();
    for (const y of [6, 12, 18]) {
        const line = document.createElementNS("http://www.w3.org/2000/svg", "path");
        line.setAttribute("d", `M4 ${y}h16`);
        line.setAttribute("fill", "none");
        line.setAttribute("stroke", "currentColor");
        line.setAttribute("stroke-linecap", "round");
        line.setAttribute("stroke-width", "2");
        icon.append(line);
    }
}

function createWordmark(): HTMLImageElement {
    const image = document.createElement("img");

    image.alt = "Extra Domain Filters";
    image.src = wordmarkUrl;
    return image;
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
    active = false,
): HTMLButtonElement {
    const button = createButton("", "edf-popup-account-menu-item");
    const text = document.createElement("span");

    button.dataset.active = String(active);
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

function createDomainStatus(data: PopupData): HTMLElement {
    const status = document.createElement("div");
    const indicator = document.createElement("span");
    const copy = document.createElement("span");
    const signedIn = data.domainSession.status === "signed-in";

    status.className = "edf-popup-domain-status";
    status.dataset.status = data.domainSession.status;
    indicator.className = "edf-popup-domain-status-indicator";
    indicator.ariaHidden = "true";
    copy.textContent = signedIn
        ? "Domain.com.au connected"
        : data.domainSession.status === "signed-out"
            ? "Domain.com.au signed out"
            : "Domain.com.au unavailable";
    status.append(indicator, copy);
    return status;
}

export function createNavigation(options: NavigationOptions): HTMLElement {
    const { activeView, data, onNavigate, onSessionChange, signal } = options;
    const header = document.createElement("header");
    const brand = createButton("", "edf-popup-brand");
    const logo = createWordmark();
    const navigation = document.createElement("nav");
    const indicator = document.createElement("span");
    const account = document.createElement("div");
    const summary = createButton("", "edf-popup-account-summary edf-popup-navigation-item");
    const menu = document.createElement("div");
    const blacklistCount = data.blacklist.filter(entry => !entry.removedAt).length;
    let open = false;
    const setOpen = (next: boolean): void => {
        open = next;
        account.dataset.open = String(open);
        menu.hidden = !open;
        summary.setAttribute("aria-expanded", String(open));
    };
    const closeAndNavigate = (view: PopupView): void => {
        setOpen(false);
        onNavigate(view);
    };

    header.className = "edf-popup-navigation";
    logo.classList.add("edf-popup-wordmark");
    brand.ariaLabel = "Extra Domain Filters";
    brand.append(logo);
    brand.addEventListener("click", () => onNavigate("saved-searches"));

    navigation.className = "edf-popup-primary-navigation";
    indicator.className = "edf-popup-navigation-indicator";
    indicator.ariaHidden = "true";
    for (const item of NAV_ITEMS) {
        const button = createButton(item.label, "edf-popup-navigation-button");
        button.dataset.active = String(item.view === activeView);
        button.dataset.popupView = item.view;
        button.addEventListener("click", () => onNavigate(item.view));
        navigation.append(button);
    }
    navigation.append(indicator);

    account.className = "edf-popup-account";
    document.addEventListener("pointerdown", event => {
        if (!account.contains(event.target as Node)) setOpen(false);
    }, { capture: true, signal });
    document.addEventListener("keydown", event => {
        if (event.key === "Escape") setOpen(false);
    }, { signal });
    summary.setAttribute("aria-haspopup", "menu");
    summary.setAttribute("aria-expanded", "false");
    summary.ariaLabel = "Open menu";
    if (data.account?.status === "signed-in") {
        summary.append(createAvatar(data.account));
    } else {
        summary.append(createSvgIcon(renderMenuIcon, "edf-popup-menu-icon"));
    }
    summary.addEventListener("click", () => setOpen(!open), { signal });

    menu.className = "edf-popup-account-menu";
    menu.hidden = true;
    const identity = data.account ? createIdentity(data.account) : undefined;
    if (identity) menu.append(identity);
    menu.append(createDomainStatus(data));
    menu.append(createMenuItem(
        "My searches",
        replaceWithPopupSavedSearchIcon,
        () => closeAndNavigate("saved-searches"),
        data.savedSearches.length,
        activeView === "saved-searches",
    ));
    if (data.account?.status === "signed-in") {
        menu.append(createMenuItem("Shortlist", replaceWithPopupStarIcon, () => {
            void chrome.tabs.create({ url: "https://www.domain.com.au/user/shortlist" });
            setOpen(false);
        }));
    }
    menu.append(
        createMenuItem(
            "Blacklist",
            replaceWithBinIcon,
            () => closeAndNavigate("blacklist"),
            blacklistCount,
            activeView === "blacklist",
        ),
        createMenuItem(
            "Preferences",
            replaceWithPopupCogIcon,
            () => closeAndNavigate("preferences"),
            undefined,
            activeView === "preferences",
        ),
    );

    const signedIn = data.account?.status === "signed-in";
    const sessionLabel = signedIn ? "Log out of sync" : "Sign in to sync";
    const session = createMenuItem(sessionLabel, replaceWithPopupDoorIcon, async () => {
        if (!signedIn) {
            closeAndNavigate("login");
            return;
        }
        session.disabled = true;
        try {
            await signOut();
            setOpen(false);
            showPopupToast("Logged out");
            onSessionChange();
        } catch (error) {
            showPopupToast(error instanceof Error ? error.message : "Unable to sign out.");
        } finally {
            session.disabled = false;
        }
    });
    session.disabled = data.account?.status === "unavailable";
    menu.append(session);
    account.append(summary, menu);
    header.append(brand, navigation, account);
    setOpen(false);
    requestAnimationFrame(() => {
        if (navigation.isConnected) placePrimaryIndicator(navigation, indicator, activeView);
    });

    return header;
}
