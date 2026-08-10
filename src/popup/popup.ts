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
import { createSavedSearchesView } from "./views/savedSearches";
import { createSignInView } from "./views/signIn";

const selectedBlacklistUrls = new Set<string>();
const selectedSavedSearchIds = new Set<string>();
let activeView: PopupView = "saved-searches";
let renderController: AbortController | undefined;

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
    const root = document.querySelector<HTMLElement>("#app");
    if (!root) return;

    renderController?.abort();
    renderController = new AbortController();
    const signal = renderController.signal;
    const data = await loadData();
    if (signal.aborted) return;

    const shell = document.createElement("main");
    const navigate = (view: PopupView): void => {
        activeView = view;
        void render();
    };

    shell.className = "edf-settings-popup";
    shell.classList.toggle("edf-popup-auth-shell", activeView === "sign-in");
    let view: HTMLElement;
    if (activeView === "sign-in") {
        view = createSignInView({
            onBack: () => navigate("saved-searches"),
            onComplete: () => navigate("saved-searches"),
        });
    } else if (activeView === "preferences") {
        view = await createPreferencesView();
    } else if (activeView === "blacklist") {
        view = createBlacklistView({
            entries: data.blacklist,
            selectedUrls: selectedBlacklistUrls,
            signal,
        });
    } else {
        view = createSavedSearchesView(data.savedSearches, selectedSavedSearchIds, signal);
    }
    if (animate) view.classList.add("edf-popup-view");
    if (activeView !== "sign-in") {
        shell.append(createNavigation({
            activeView,
            data,
            onNavigate: navigate,
            onSessionChange: () => void render(),
            signal,
        }));
    }
    shell.append(view);

    if (!signal.aborted) root.replaceChildren(shell);
}

onStorageChange("blacklist", () => void render(false));
onStorageChange("savedSearches", () => void render(false));
void render();
