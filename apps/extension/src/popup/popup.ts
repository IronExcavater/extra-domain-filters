import "../content/tokens.css";
import "../features/blacklist/styles.css";
import "../features/saved-searches/styles.css";
import "../features/settings/settings.css";
import "../ui/collection.css";
import "../ui/domainControls.css";
import "../ui/popover.css";
import "../ui/resize.css";
import "../ui/sort.css";
import "../ui/toast.css";
import "../ui/tooltip.css";
import "./popup.css";

import { getAccountState } from "../domain/account/client";
import { getBlacklist } from "../domain/blacklist/store";
import { getSavedSearches } from "../domain/searches/savedSearches";
import { createSettingsContent } from "../features/settings/view";
import { onStorageChange } from "../platform/storage";
import {
    getDomainSession,
    isDomainSessionStale,
    syncDomainSavedSearchesFromExtensionPage,
} from "../platform/domainPageClient";
import { getSettings } from "../state/settings";
import { enableResizablePopup } from "../ui/resize";
import { createNavigation } from "./components/navigation";
import type { PopupData, PopupView } from "./model";
import { createBlacklistView } from "./views/blacklist";
import { createFiltersView } from "./views/filters";
import { createLoginView } from "./views/login";
import { createSavedSearchesView } from "./views/savedSearches";

const selectedBlacklistUrls = new Set<string>();
const selectedSavedSearchIds = new Set<string>();
let activeView: PopupView = "saved-searches";
let loginReturnView: Exclude<PopupView, "login"> = "saved-searches";
let renderController: AbortController | undefined;
let renderedView: PopupView | undefined;
let domainSessionPromise: Promise<unknown> | undefined;
// Everything the popup shows, kept in memory: switching views renders straight from it, and
// storage changes refresh only the key that changed. The account (answered by the background
// worker, which may first have to wake up) loads alongside and never blocks a render.
let data: PopupData = { blacklist: [], domainSession: { status: "unavailable" }, savedSearches: [] };
const root = document.querySelector<HTMLElement>("#app");
const shell = document.createElement("main");
const navigationHost = document.createElement("div");
const viewHost = document.createElement("div");

shell.className = "edf-settings-popup";
navigationHost.className = "edf-popup-navigation-host";
viewHost.className = "edf-popup-view-host";
shell.append(navigationHost, viewHost);
// Built once and updated in place, so its underlines, pill and menu transition instead of
// being replaced on every re-render.
const navigation = createNavigation({
    onNavigate: view => navigate(view),
    onSessionChange: () => void loadAccount(),
    onSyncDomain: () => refreshDomainSavedSearches(true),
});
navigationHost.append(navigation.element);
root?.replaceChildren(shell);
void enableResizablePopup(shell);

async function loadAccount(): Promise<void> {
    data = { ...data, account: await getAccountState().catch(() => undefined) };
    if (activeView === "login") void render(false);
    else navigation.update({ activeView, data });
}

/**
 * Checking Domain means opening a hidden Domain tab, so it only happens when the remembered
 * check is stale (see isDomainSessionStale) or the user asks for it. The stored result
 * reaches the popup through the "domainSession" storage listener.
 */
function refreshDomainSavedSearches(force = false): void {
    if (domainSessionPromise) return;
    domainSessionPromise = (async () => {
        if (!force && !isDomainSessionStale(await getDomainSession())) return;
        navigation.setSyncing(true);
        try {
            await syncDomainSavedSearchesFromExtensionPage();
        } finally {
            // Apply the stored result first, so the pill goes straight from syncing to it.
            data = { ...data, domainSession: await getDomainSession() };
            navigation.update({ activeView, data });
            navigation.setSyncing(false);
        }
    })().catch(() => undefined).finally(() => {
        domainSessionPromise = undefined;
    });
}

function navigate(view: PopupView): void {
    if (view === activeView) return;
    if (view === "login") loginReturnView = activeView === "login" ? loginReturnView : activeView;
    activeView = view;
    void render();
}

async function createPreferencesView(): Promise<HTMLElement> {
    const content = document.createElement("section");
    content.className = "edf-popup-content";
    content.append(createSettingsContent(await getSettings(), {
        // Filter toggles live on the Filters page.
        excludeSections: ["filters"],
        includeIntroduction: false,
        sectionHeading: "h2",
        titleHeading: "h1",
        toastScope: "popup",
    }));

    return content;
}

async function render(animate = true): Promise<void> {
    if (!root) return;

    renderController?.abort();
    renderController = new AbortController();
    const signal = renderController.signal;

    shell.classList.toggle("edf-popup-auth-shell", activeView === "login");
    navigationHost.hidden = activeView === "login";
    if (activeView !== "login") navigation.update({ activeView, data });
    let view: HTMLElement;
    if (activeView === "login") {
        view = createLoginView({
            account: data.account,
            onBack: () => navigate(loginReturnView),
            onComplete: () => {
                void loadAccount();
                navigate(loginReturnView);
            },
        });
    } else if (activeView === "preferences") {
        view = await createPreferencesView();
    } else if (activeView === "filters") {
        view = createFiltersView({ settings: await getSettings(), signal });
    } else if (activeView === "blacklist") {
        view = createBlacklistView({
            animate,
            entries: data.blacklist,
            selectedUrls: selectedBlacklistUrls,
            signal,
        });
    } else {
        view = createSavedSearchesView(
            data.savedSearches,
            selectedSavedSearchIds,
            signal,
            animate,
            data.domainSession,
        );
    }
    if (signal.aborted) return;
    // A data re-render of the same view (e.g. after unblacklisting) keeps the scroll position.
    const scrollTop = renderedView === activeView ? viewHost.firstElementChild?.scrollTop ?? 0 : 0;
    viewHost.replaceChildren(view);
    if (scrollTop) view.scrollTop = scrollTop;
    // Switching views eases the new one in; data re-renders of the same view swap in place.
    if (renderedView !== undefined && renderedView !== activeView
        && !window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
        view.animate(
            [{ opacity: 0, transform: "translateY(6px)" }, { opacity: 1, transform: "none" }],
            { duration: 200, easing: "cubic-bezier(0.2, 0, 0, 1)" },
        );
    }
    renderedView = activeView;
}

onStorageChange("blacklist", async () => {
    data = { ...data, blacklist: await getBlacklist() };
    navigation.update({ activeView, data });
    if (activeView === "blacklist") void render(false);
});
onStorageChange("savedSearches", async () => {
    data = { ...data, savedSearches: await getSavedSearches() };
    navigation.update({ activeView, data });
    if (activeView === "saved-searches") void render(false);
});
onStorageChange("domainSession", async () => {
    const previous = data.domainSession.status;
    data = { ...data, domainSession: await getDomainSession() };
    navigation.update({ activeView, data });
    // Only the signed-out notice in My Searches depends on it.
    if (activeView === "saved-searches" && previous !== data.domainSession.status) void render(false);
});
window.addEventListener("focus", () => refreshDomainSavedSearches());
document.addEventListener("visibilitychange", () => {
    if (document.visibilityState === "visible") refreshDomainSavedSearches();
});

void (async () => {
    const [blacklist, savedSearches, domainSession] = await Promise.all([
        getBlacklist(),
        getSavedSearches(),
        getDomainSession(),
    ]);
    data = { ...data, blacklist, domainSession, savedSearches };
    await render();
    void loadAccount();
    refreshDomainSavedSearches();
})();
