import "../app/tokens.css";
import "../features/blacklist/styles.css";
import "../features/saved-searches/styles.css";
import "../features/settings/settings.css";
import "../shared/ui/collection.css";
import "../shared/ui/domainControls.css";
import "../shared/ui/popover.css";
import "../shared/ui/sort.css";
import "../shared/ui/toast.css";
import "../shared/ui/tooltip.css";
import "./popup.css";

import { getAccountState } from "../domain/account/client";
import { getBlacklist } from "../domain/blacklist/store";
import { getSavedSearches } from "../domain/searches/savedSearches";
import { createSettingsContent } from "../features/settings/view";
import { onStorageChange } from "../shared/platform/storage";
import { getSettings } from "../shared/state/settings";
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
const root = document.querySelector<HTMLElement>("#app");
const shell = document.createElement("main");
const navigationHost = document.createElement("div");
const viewHost = document.createElement("div");

shell.className = "edf-settings-popup";
navigationHost.className = "edf-popup-navigation-host";
viewHost.className = "edf-popup-view-host";
shell.append(navigationHost, viewHost);
root?.replaceChildren(shell);

async function loadData(): Promise<PopupData> {
    const [blacklist, savedSearches, account] = await Promise.all([
        getBlacklist(),
        getSavedSearches(),
        getAccountState().catch(() => undefined),
    ]);

    return { account, blacklist, savedSearches };
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
        view = createSavedSearchesView(data.savedSearches, selectedSavedSearchIds, signal, animate);
    }
    if (activeView !== "login") {
        navigationHost.replaceChildren(createNavigation({
            activeView,
            data,
            onNavigate: navigate,
            onSessionChange: () => void render(),
            signal,
        }));
    } else {
        navigationHost.replaceChildren();
    }

    if (!signal.aborted) viewHost.replaceChildren(view);
}

onStorageChange("blacklist", () => void render(false));
onStorageChange("savedSearches", () => void render(false));
void render();
