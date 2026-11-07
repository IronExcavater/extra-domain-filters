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
import { syncDomainSavedSearchesFromExtensionPage } from "../platform/domainPageClient";
import { getSettings } from "../state/settings";
import { enableResizablePopup } from "../ui/resize";
import { createNavigation } from "./components/navigation";
import type { PopupData, PopupView } from "./model";
import { createBlacklistView } from "./views/blacklist";
import { createLoginView } from "./views/login";
import { createSavedSearchesView } from "./views/savedSearches";

const selectedBlacklistUrls = new Set<string>();
const selectedSavedSearchIds = new Set<string>();
let activeView: PopupView = "saved-searches";
let loginReturnView: Exclude<PopupView, "login"> = "saved-searches";
let renderController: AbortController | undefined;
let navigationKey = "";
let navigationController: AbortController | undefined;
let domainSessionPromise: ReturnType<typeof syncDomainSavedSearchesFromExtensionPage> | undefined;
let domainSessionState: PopupData["domainSession"] = { status: "unavailable" };
let lastDomainSyncAt = 0;
const DOMAIN_SYNC_TTL_MS = 60_000;
const root = document.querySelector<HTMLElement>("#app");
const shell = document.createElement("main");
const navigationHost = document.createElement("div");
const viewHost = document.createElement("div");

shell.className = "edf-settings-popup";
navigationHost.className = "edf-popup-navigation-host";
viewHost.className = "edf-popup-view-host";
shell.append(navigationHost, viewHost);
root?.replaceChildren(shell);
void enableResizablePopup(shell);

async function loadData(): Promise<PopupData> {
    const [blacklist, savedSearches, account] = await Promise.all([
        getBlacklist(),
        getSavedSearches(),
        getAccountState().catch(() => undefined),
    ]);

    return { account, blacklist, domainSession: domainSessionState, savedSearches };
}

function refreshDomainSavedSearches(force = false): void {
    if (domainSessionPromise) return;
    if (!force && Date.now() - lastDomainSyncAt < DOMAIN_SYNC_TTL_MS) return;

    lastDomainSyncAt = Date.now();
    domainSessionPromise = syncDomainSavedSearchesFromExtensionPage();
    void domainSessionPromise
        .then(state => {
            const changed = state.status !== domainSessionState.status || state.count !== domainSessionState.count;
            domainSessionState = state;
            if (changed && activeView === "saved-searches") void render(false);
        })
        .finally(() => {
            domainSessionPromise = undefined;
        });
}

async function createPreferencesView(): Promise<HTMLElement> {
    const content = document.createElement("section");
    content.className = "edf-popup-content";
    content.append(createSettingsContent(await getSettings(), {
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
    const data = await loadData();
    if (signal.aborted) return;

    const navigate = (view: PopupView): void => {
        if (view === "login" && activeView !== "login") {
            loginReturnView = activeView;
        }
        activeView = view;
        void render();
    };

    shell.classList.toggle("edf-popup-auth-shell", activeView === "login");
    navigationHost.hidden = activeView === "login";
    let view: HTMLElement;
    if (activeView === "login") {
        view = createLoginView({
            account: data.account,
            onBack: () => navigate(loginReturnView),
            onComplete: () => navigate(loginReturnView),
        });
    } else if (activeView === "preferences") {
        view = await createPreferencesView();
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
    // Rebuild the header only when something it shows changed. Storage-driven re-renders
    // land right after a tab switch and used to replace the header mid-way through the
    // underline's slide, so it snapped instead of animating.
    const nextNavigationKey = activeView === "login" ? "" : JSON.stringify([
        activeView,
        data.account?.status,
        data.account?.profile?.photoUrl,
        data.domainSession.status,
        data.savedSearches.length,
        data.blacklist.filter(entry => !entry.removedAt).length,
    ]);
    if (nextNavigationKey !== navigationKey) {
        navigationKey = nextNavigationKey;
        navigationController?.abort();
        navigationController = new AbortController();
        navigationHost.replaceChildren(...(activeView === "login" ? [] : [createNavigation({
            activeView,
            data,
            onNavigate: navigate,
            onSessionChange: () => void render(),
            signal: navigationController.signal,
        })]));
    }

    if (!signal.aborted) viewHost.replaceChildren(view);
}

onStorageChange("blacklist", () => void render(false));
onStorageChange("savedSearches", () => void render(false));
window.addEventListener("focus", () => refreshDomainSavedSearches());
document.addEventListener("visibilitychange", () => {
    if (document.visibilityState === "visible") refreshDomainSavedSearches();
});
refreshDomainSavedSearches(true);
void render();
