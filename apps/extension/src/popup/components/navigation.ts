import { browser } from "wxt/browser";
import wordmarkUrl from "../../../../../packages/assets/icons/brand/wordmark.svg?url";
import { signOut } from "../../domain/account/client";
import type { AccountState } from "../../domain/account/model";
import type { DomainSessionState } from "../../platform/domainPageClient";
import { createButton, createSvgIcon, type IconRenderer } from "../../ui/elements";
import {
    replaceWithBinIcon,
    replaceWithChevronIcon,
    replaceWithConnectedIcon,
    replaceWithDisconnectedIcon,
    replaceWithPersonIcon,
    replaceWithPopupCogIcon,
    replaceWithPopupDoorIcon,
    replaceWithPopupSavedSearchIcon,
    replaceWithPopupStarIcon,
    replaceWithSlidersIcon,
    replaceWithSyncIcon,
} from "../../ui/icons";
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
    { label: "My Searches", view: "saved-searches" },
    { label: "Filters", view: "filters" },
    { label: "Blacklist", view: "blacklist" },
] satisfies Array<{ label: string; view: PopupView }>;
const DOMAIN_HOME_URL = "https://www.domain.com.au/";
const DOMAIN_SIGN_IN_URL = "https://www.domain.com.au/user/saved-searches";
const EASE = "cubic-bezier(0.2, 0, 0, 1)";

const reducedMotion = (): boolean => window.matchMedia("(prefers-reduced-motion: reduce)").matches;

/**
 * A header tab, as Domain's own header: plain text, with its own underline (CSS ::after) while
 * it is the active view. Switching tabs slides the line across (slideUnderline).
 */
function createNavItem(text: string): HTMLButtonElement {
    const item = createButton("", "edf-popup-nav-item");
    const label = document.createElement("span");
    label.className = "edf-popup-nav-item-label";
    // The bold copy reserves the active width, so selecting a tab never nudges its neighbours.
    label.dataset.text = text;
    label.textContent = text;
    item.append(label);
    return item;
}

/** Domain's avatar: the photo, else an initial, else (signed out) a person outline. */
function createAvatar(state: AccountState | undefined): HTMLElement {
    const avatar = document.createElement("span");
    avatar.className = "edf-popup-avatar";
    avatar.ariaHidden = "true";
    if (state?.status !== "signed-in") {
        avatar.append(createSvgIcon(replaceWithPersonIcon, "edf-popup-avatar-icon"));
    } else if (state.profile?.photoUrl) {
        const image = document.createElement("img");
        image.alt = "";
        image.src = state.profile.photoUrl;
        avatar.append(image);
    } else {
        avatar.dataset.initial = "true";
        avatar.textContent = (state.profile?.displayName ?? state.profile?.email ?? "E").slice(0, 1).toUpperCase();
    }
    return avatar;
}

/**
 * Moves the active underline from one tab to the next: the new tab's own line starts over
 * the old one and eases into place. Their CSS transitions are paused meanwhile, as a
 * transition would otherwise override the animation.
 */
function slideUnderline(from: HTMLElement, to: HTMLElement): void {
    if (reducedMotion() || !from.isConnected || from.offsetWidth === 0 || to.offsetWidth === 0) return;
    const start = from.getBoundingClientRect();
    const end = to.getBoundingClientRect();
    from.dataset.sliding = "true";
    to.dataset.sliding = "true";
    const animation = to.animate(
        [
            { transform: `translateX(${start.left - end.left}px) scaleX(${start.width / end.width})` },
            { transform: "translateX(0) scaleX(1)" },
        ],
        { duration: 300, easing: EASE, pseudoElement: "::after" },
    );
    const settle = (): void => {
        delete from.dataset.sliding;
        delete to.dataset.sliding;
    };
    animation.addEventListener("finish", settle);
    animation.addEventListener("cancel", settle);
}

function createMenuItem(
    label: string,
    renderIcon: IconRenderer,
    onClick: () => void,
    /** A count shows as a badge; text (e.g. "5 min ago") as a quiet note. */
    count?: number | string,
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
        badge.className = typeof count === "number" ? "edf-popup-account-menu-count" : "edf-popup-account-menu-note";
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
    if (checkedAt === undefined) return "";
    const minutes = Math.round((Date.now() - checkedAt) / 60_000);
    if (minutes < 1) return "just now";
    if (minutes < 60) return `${minutes} min ago`;
    const hours = Math.round(minutes / 60);
    return `${hours} hr${hours === 1 ? "" : "s"} ago`;
}

type DomainState = "connected" | "offline" | "signed-out" | "syncing";

/** Domain sync, as the menu's first row: what it says, a note, and its icon. */
function describeDomain(session: DomainSessionState, syncing: boolean): {
    icon: IconRenderer;
    label: string;
    note?: string;
    state: DomainState;
} {
    if (syncing) return { icon: replaceWithSyncIcon, label: "Syncing with Domain\u2026", state: "syncing" };
    if (session.status === "signed-in") {
        return { icon: replaceWithConnectedIcon, label: "Synced with Domain", note: formatCheckedAt(session.checkedAt), state: "connected" };
    }
    if (session.status === "signed-out") {
        return { icon: replaceWithDisconnectedIcon, label: "Sign in to Domain", note: "to sync", state: "signed-out" };
    }
    return session.checkedAt === undefined
        ? { icon: replaceWithSyncIcon, label: "Sync with Domain", state: "offline" }
        : { icon: replaceWithDisconnectedIcon, label: "Couldn't reach Domain", note: "Retry", state: "offline" };
}

export function createNavigation(options: NavigationOptions): Navigation {
    const header = document.createElement("header");
    const start = document.createElement("div");
    const brand = createButton("", "edf-popup-brand");
    const logo = document.createElement("img");
    const navigation = document.createElement("nav");
    const actions = document.createElement("div");
    const account = document.createElement("div");
    const trigger = createButton("", "edf-popup-menu-trigger");
    const chevron = createSvgIcon(replaceWithChevronIcon, "edf-popup-menu-chevron");
    const menu = document.createElement("div");
    const tabs = NAV_ITEMS.map(item => {
        const tab = createNavItem(item.label);
        tab.dataset.popupView = item.view;
        tab.addEventListener("click", () => options.onNavigate(item.view));
        return tab;
    });
    let open = false;
    let syncing = false;
    let triggerKey: string | undefined;
    let lastState: NavigationState | undefined;

    const setOpen = (next: boolean): void => {
        open = next;
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
    brand.ariaLabel = "Open Domain.com.au";
    brand.append(logo);
    brand.addEventListener("click", () => void browser.tabs.create({ url: DOMAIN_HOME_URL }));
    start.append(brand);

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
    trigger.ariaLabel = "Account and menu";
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
        const domain = describeDomain(data.domainSession, syncing);
        const domainItem = createMenuItem(domain.label, domain.icon, () => {
            if (domain.state === "signed-out") {
                void browser.tabs.create({ url: DOMAIN_SIGN_IN_URL });
                setOpen(false);
            } else {
                options.onSyncDomain();
            }
        }, domain.note);
        domainItem.classList.add("edf-popup-domain-item");
        domainItem.dataset.state = domain.state;
        domainItem.disabled = domain.state === "syncing";
        const domainDivider = document.createElement("hr");
        domainDivider.className = "edf-popup-account-menu-divider";
        items.push(domainItem, domainDivider);
        items.push(createMenuItem(
            "My searches",
            replaceWithPopupSavedSearchIcon,
            () => closeAndNavigate("saved-searches"),
            data.savedSearches.length,
            activeView === "saved-searches",
        ));
        if (data.domainSession.status === "signed-in") {
            items.push(createMenuItem("Shortlist", replaceWithPopupStarIcon, () => {
                void browser.tabs.create({ url: "https://www.domain.com.au/user/shortlist" });
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
            trigger.dataset.syncing = String(syncing);
            if (lastState) renderMenu(lastState);
        },
        update(state) {
            const { activeView, data } = state;
            const previous = tabs.find(tab => tab.dataset.active === "true");
            const next = tabs.find(tab => tab.dataset.popupView === activeView);
            for (const tab of tabs) tab.dataset.active = String(tab === next);
            if (previous && next && previous !== next) slideUnderline(previous, next);

            const user = data.account;
            const nextTriggerKey = user?.status === "signed-in"
                ? `avatar:${user.profile?.photoUrl ?? user.profile?.displayName ?? user.profile?.email ?? ""}`
                : "signed-out";
            if (nextTriggerKey !== triggerKey) {
                triggerKey = nextTriggerKey;
                trigger.replaceChildren(createAvatar(user), chevron);
            }

            // The avatar carries a dot while Domain needs attention (signed out, unreachable).
            trigger.dataset.domainAttention = String(data.domainSession.status === "signed-out"
                || (data.domainSession.status === "unavailable" && data.domainSession.checkedAt !== undefined));
            lastState = state;
            renderMenu(state);
        },
    };
}
