import "../features/settings/settings.css";
import "./popup.css";
import { createSettingsContent } from "../features/settings/view";
import { onStorageChange } from "../shared/platform/storage";
import { getSettings, type Settings } from "../shared/state/settings";
import { createBlacklistContent, type PopupSort } from "./blacklist";
import { createFiltersContent } from "./filters";
import { createNavigation, type PopupView } from "./navigation";

const selectedUrls = new Set<string>();
let activeView: PopupView = "filters";
let blacklistSort: PopupSort = "recent";

async function render(): Promise<void> {
    const root = document.querySelector<HTMLElement>("#app");
    if (!root) return;

    const shell = document.createElement("main");
    shell.className = "edf-settings-popup";
    shell.append(createNavigation({
        activeView,
        onNavigate: view => {
            activeView = view;
            void render();
        },
    }));

    if (activeView === "preferences") {
        const content = document.createElement("section");
        content.className = "edf-popup-content";
        content.append(createSettingsContent(await getSettings(), {
            includeIntroduction: false,
            sectionHeading: "h2",
            titleHeading: "h1",
        }));
        shell.append(content);
    } else if (activeView === "filters") {
        shell.append(await createFiltersContent());
    } else {
        shell.append(await createBlacklistContent({
            selectedUrls,
            sort: blacklistSort,
            onSelectionChange: () => void render(),
            onSortChange: sort => {
                blacklistSort = sort;
                void render();
            },
            onChanged: () => void render(),
        }));
    }

    root.replaceChildren(shell);
}

onStorageChange<Settings>("settings", () => void render());
onStorageChange("blacklist", () => void render());
onStorageChange("filter-presets", () => void render());
void render();
