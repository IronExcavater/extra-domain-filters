import "../features/settings/settings.css";
import "./popup.css";
import { SETTINGS_SECTIONS, type SettingDefinition } from "../features/settings/definitions";
import { getSettings, updateSettings, type Settings } from "../shared/state/settings";

function createSetting(definition: SettingDefinition, settings: Settings): HTMLElement {
    const row = document.createElement("div");
    row.className = "edf-settings-row";
    const copy = document.createElement("div");
    const title = document.createElement("p");
    const description = document.createElement("p");
    copy.className = "edf-settings-copy";
    title.className = "edf-settings-row-title";
    description.className = "edf-settings-row-description";
    title.textContent = definition.title;
    description.textContent = definition.description;
    copy.append(title, description);

    const toggle = document.createElement("label");
    toggle.className = "edf-settings-toggle";
    const input = document.createElement("input");
    input.type = "checkbox";
    input.checked = definition.read(settings);
    input.ariaLabel = definition.title;
    const indicator = document.createElement("span");
    indicator.className = "edf-settings-toggle-indicator";
    input.className = "edf-settings-toggle-input";
    const control = document.createElement("span");
    control.className = "edf-settings-toggle-control";
    const switchControl = document.createElement("span");
    switchControl.className = "edf-settings-toggle-switch";
    indicator.append(switchControl);
    control.append(input, indicator);
    toggle.append(control);
    input.addEventListener("change", () => void updateSettings(definition.write(input.checked)));
    row.append(copy, toggle);
    return row;
}

async function render(): Promise<void> {
    const root = document.querySelector<HTMLElement>("#app");
    if (!root) return;
    const settings = await getSettings();
    const shell = document.createElement("main");
    shell.className = "edf-settings-popup";
    const heading = document.createElement("header");
    heading.className = "edf-settings-introduction";
    const title = document.createElement("h1");
    title.className = "edf-settings-title";
    title.textContent = "Extra Domain Filters";
    const subtitle = document.createElement("p");
    subtitle.className = "edf-settings-description";
    subtitle.textContent = "Manage how Extra Domain Filters changes your Domain experience.";
    heading.append(title, subtitle);
    shell.append(heading);

    for (const section of SETTINGS_SECTIONS) {
        const content = document.createElement("section");
        content.className = "edf-settings-section";
        const sectionTitle = document.createElement("h2");
        sectionTitle.className = "edf-settings-section-title";
        sectionTitle.textContent = section.title;
        content.append(sectionTitle, ...section.settings.map(setting => createSetting(setting, settings)));
        shell.append(content);
    }
    root.replaceChildren(shell);
}

void render();
