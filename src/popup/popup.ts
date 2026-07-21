import "../features/settings/settings.css";
import "./popup.css";
import { createSettingsContent } from "../features/settings/view";
import { getSettings } from "../shared/state/settings";

async function render(): Promise<void> {
    const root = document.querySelector<HTMLElement>("#app");
    if (!root) return;
    const settings = await getSettings();
    const shell = document.createElement("main");
    shell.className = "edf-settings-popup";
    shell.append(createSettingsContent(settings, {
        sectionHeading: "h2",
        titleHeading: "h1",
    }));
    root.replaceChildren(shell);
}

void render();
