import wordmarkUrl from "../../../../../packages/assets/icons/brand/wordmark.svg?url";
import { signOut } from "../../domain/account/client";
import type { AccountState } from "../../domain/account/model";
import type { DomainSessionState } from "../../platform/domainPageClient";
import { createButton, createSvgIcon, type IconRenderer } from "../../ui/elements";
import {
    replaceWithBinIcon,
    replaceWithConnectedIcon,
    replaceWithDisconnectedIcon,
    replaceWithPopupCogIcon,
    replaceWithPopupDoorIcon,
    replaceWithPopupSavedSearchIcon,
    replaceWithPopupStarIcon,
    replaceWithSlidersIcon,
} from "../../ui/icons";
import { attachTooltip } from "../../ui/tooltip";
import type { PopupData, PopupView } from "../model";
import { showPopupToast } from "../toast";

export interface NavigationState {
    activeView: PopupView;
    data: PopupData;
}

export interface Navigation {
    element: HTMLElement;
    setSyncing(syncing: boolean): void;
    update(state: NavigationState): void;
}

interface NavigationOptions {
    onNavigate(view: PopupView): void;
    onSessionChange(): void;
    onSyncDomain(): void;
}

const NAV_ITEMS = [
    { icon: replaceWithPopupSavedSearchIcon, label: "My Searches", view: "saved-searches" },
    { icon: replaceWithSlidersIcon, label: "Filters", view: "filters" },
    { icon: replaceWithBinIcon, label: "Blacklist", view: "blacklist" },
] satisfies Array<{ icon: IconRenderer; label: string; view: PopupView }>;
const DOMAIN_SIGN_IN_URL = "https://www.domain.com.au/user/saved-searches";
const EASE = "cubic-bezier(0.2, 0, 0, 1)";

const reducedMotion = (): boolean => window.matchMedia("(prefers-reduced-motion: reduce)").matches;

function renderMenuIcon(icon: SVGElement): void {
    icon.setAttribute("viewBox", "0 0 24 24");
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

/**
 * The one header item: optional icon, optional label, and its own underline (CSS ::after),
 * shown while it is the active view or its menu is open. The underline is part of the item,
 * so it always sits under it and animates in place.
 */
function createNavItem(options: { icon?: IconRenderer; label?: string; className?: string }): HTMLButtonElement {
    const item = createButton("", ["edf-popup-nav-item", options.className].filter(Boolean).join(" "));
    if (options.icon) item.append(createSvgIcon(options.icon, "edf-popup-nav-item-icon"));
    if (options.label) {
        const label = document.createElement("span");
        label.className = "edf-popup-nav-item-label";
        // The bold copy reserves the active width, so selecting a tab never nudges its neighbours.
        label.dataset.text = options.label;
        label.textContent = options.label;
        item.append(label);
    }
    return item;
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
    button.setAttribute("role", "menuitem");
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

function formatCheckedAt(checkedAt: number | undefined): string {
    if (checkedAt === undefined) return "not synced yet";
    const minutes = Math.round((Date.now() - checkedAt) / 60_000);
    if (minutes < 1) return "synced just now";
    if (minutes < 60) return `synced ${minutes} min ago`;
    const hours = Math.round(minutes / 60);
    return `synced ${hours} hr${hours === 1 ? "" : "s"} ago`;
}

type DomainPillState = "connected" | "offline" | "signed-out" | "syncing";

function describeDomain(
    session: DomainSessionState,
    syncing: boolean,
): { label: string; state: DomainPillState; tooltip: string } {
    if (syncing) return { label: "Syncing", state: "syncing", tooltip: "Syncing saved searches with Domain.com.au…" };
    if (session.status === "signed-in") {
        return {
            label: "Synced",
            state: "connected",
            tooltip: `Connected to Domain.com.au, ${formatCheckedAt(session.checkedAt)}. Click to sync now.`,
        };
    }
    if (session.status === "signed-out") {
        return {
            label: "Sign in",
            state: "signed-out",
            tooltip: "Signed out of Domain.com.au, so saved searches can't sync. Click to sign in.",
        };
    }
    return session.checkedAt === undefined
        ? { label: "Connect", state: "offline", tooltip: "Not synced with Domain.com.au yet. Click to sync." }
        : { label: "Offline", state: "offline", tooltip: "Couldn't reach Domain.com.au. Click to try again." };
}

/**
 * Domain.com.au connection, as a small pill beside the wordmark. The icon (linked, unlinked,
 * spinner) cross-fades and the pill eases to its new width when the state changes.
 */
function createDomainPill(onSync: () => void): {
    element: HTMLButtonElement;
    update(session: DomainSessionState, syncing: boolean): void;
} {
    const pill = createButton("", "edf-popup-domain-pill");
    const icon = document.createElement("span");
    const label = document.createElement("span");
    const spinner = document.createElement("span");
    const tooltip = attachTooltip(pill, "", { placement: "bottom" });
    let state: DomainPillState | undefined;

    icon.className = "edf-popup-domain-pill-icon";
    icon.ariaHidden = "true";
    spinner.className = "edf-popup-domain-pill-spinner";
    icon.append(
        createSvgIcon(replaceWithConnectedIcon, "edf-popup-domain-pill-connected"),
        createSvgIcon(replaceWithDisconnectedIcon, "edf-popup-domain-pill-disconnected"),
        spinner,
    );
    label.className = "edf-popup-domain-pill-label";
    pill.append(icon, label);
    pill.addEventListener("click", () => {
        if (state === "syncing") return;
        if (state === "signed-out") void chrome.tabs.create({ url: DOMAIN_SIGN_IN_URL });
        else onSync();
    });

    return {
        element: pill,
        update(session, syncing) {
            const next = describeDomain(session, syncing);
            state = next.state;
            pill.dataset.state = next.state;
            pill.ariaBusy = String(next.state === "syncing");
            pill.ariaLabel = `Domain.com.au: ${next.label}`;
            tooltip.setText(next.tooltip);
            if (label.textContent === next.label) return;

            const from = pill.isConnected ? pill.getBoundingClientRect().width : 0;
            label.textContent = next.label;
            if (!from || reducedMotion()) return;
            const to = pill.getBoundingClientRect().width;
            if (Math.abs(from - to) >= 1) {
                pill.animate([{ width: `${from}px` }, { width: `${to}px` }], { duration: 220, easing: EASE });
            }
            label.animate([{ opacity: 0 }, { opacity: 1 }], { duration: 180, easing: "ease-out" });
        },
    };
}

export function createNavigation(options: NavigationOptions): Navigation {
    const header = document.createElement("header");
    const start = document.createElement("div");
    const brand = createButton("", "edf-popup-brand");
    const logo = document.createElement("img");
    const domain = createDomainPill(options.onSyncDomain);
    const navigation = document.createElement("nav");
    const actions = document.createElement("div");
    const account = document.createElement("div");
    const trigger = createNavItem({ className: "edf-popup-menu-trigger" });
    const menu = document.createElement("div");
    const tabs = NAV_ITEMS.map(item => {
        const tab = createNavItem({ icon: item.icon, label: item.label });
        tab.dataset.popupView = item.view;
        tab.addEventListener("click", () => options.onNavigate(item.view));
        return tab;
    });
    let open = false;
    let session: DomainSessionState = { status: "unavailable" };
    let syncing = false;
    let triggerKey: string | undefined;

    const setOpen = (next: boolean): void => {
        open = next;
        header.dataset.menuOpen = String(open);
        account.dataset.open = String(open);
        menu.inert = !open;
        trigger.setAttribute("aria-expanded", String(open));
    };
    const closeAndNavigate = (view: PopupView): void => {
        setOpen(false);
        options.onNavigate(view);
    };

    header.className = "edf-popup-navigation";
    start.className = "edf-popup-navigation-start";
    logo.className = "edf-popup-wordmark";
    logo.alt = "Extra Domain Filters";
    logo.src = wordmarkUrl;
    brand.ariaLabel = "Extra Domain Filters";
    brand.append(logo);
    brand.addEventListener("click", () => options.onNavigate("saved-searches"));
    start.append(brand, domain.element);

    navigation.className = "edf-popup-primary-navigation";
    navigation.append(...tabs);

    account.className = "edf-popup-account";
    document.addEventListener("pointerdown", event => {
        if (open && !account.contains(event.target as Node)) setOpen(false);
    }, { capture: true });
    document.addEventListener("keydown", event => {
        if (event.key === "Escape" && open) setOpen(false);
    });
    trigger.setAttribute("aria-haspopup", "menu");
    trigger.ariaLabel = "Open menu";
    trigger.addEventListener("click", () => setOpen(!open));
    menu.className = "edf-popup-account-menu";
    menu.setAttribute("role", "menu");
    account.append(trigger, menu);
    actions.className = "edf-popup-navigation-actions";
    actions.append(account);
    header.append(start, navigation, actions);
    setOpen(false);

    const renderMenu = ({ activeView, data }: NavigationState): void => {
        const signedIn = data.account?.status === "signed-in";
        const items: HTMLElement[] = [];
        const identity = data.account ? createIdentity(data.account) : undefined;
        if (identity) items.push(identity);
        items.push(createMenuItem(
            "My searches",
            replaceWithPopupSavedSearchIcon,
            () => closeAndNavigate("saved-searches"),
            data.savedSearches.length,
            activeView === "saved-searches",
        ));
        if (signedIn) {
            items.push(createMenuItem("Shortlist", replaceWithPopupStarIcon, () => {
                void chrome.tabs.create({ url: "https://www.domain.com.au/user/shortlist" });
                setOpen(false);
            }));
        }
        items.push(
            createMenuItem(
                "Filters",
                replaceWithSlidersIcon,
                () => closeAndNavigate("filters"),
                undefined,
                activeView === "filters",
            ),
            createMenuItem(
                "Blacklist",
                replaceWithBinIcon,
                () => closeAndNavigate("blacklist"),
                data.blacklist.filter(entry => !entry.removedAt).length,
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

        const sessionItem = createMenuItem(signedIn ? "Log out of sync" : "Sign in to sync", replaceWithPopupDoorIcon, async () => {
            if (!signedIn) {
                closeAndNavigate("login");
                return;
            }
            sessionItem.disabled = true;
            try {
                await signOut();
                setOpen(false);
                showPopupToast("Logged out");
                options.onSessionChange();
            } catch (error) {
                showPopupToast(error instanceof Error ? error.message : "Unable to sign out.");
            } finally {
                sessionItem.disabled = false;
            }
        });
        sessionItem.disabled = data.account?.status === "unavailable";
        const divider = document.createElement("hr");
        divider.className = "edf-popup-account-menu-divider";
        items.push(divider, sessionItem);
        menu.replaceChildren(...items);
    };

    return {
        element: header,
        setSyncing(next) {
            syncing = next;
            domain.update(session, syncing);
        },
        update(state) {
            const { activeView, data } = state;
            for (const tab of tabs) tab.dataset.active = String(tab.dataset.popupView === activeView);
            // Views that only live in the menu (Preferences) mark the menu trigger instead.
            trigger.dataset.active = String(!NAV_ITEMS.some(item => item.view === activeView));

            const user = data.account;
            const nextTriggerKey = user?.status === "signed-in"
                ? `avatar:${user.profile?.photoUrl ?? user.profile?.displayName ?? user.profile?.email ?? ""}`
                : "menu";
            if (nextTriggerKey !== triggerKey) {
                triggerKey = nextTriggerKey;
                trigger.replaceChildren(user?.status === "signed-in"
                    ? createAvatar(user)
                    : createSvgIcon(renderMenuIcon, "edf-popup-nav-item-icon"));
            }

            session = data.domainSession;
            domain.update(session, syncing);
            renderMenu(state);
        },
    };
}
