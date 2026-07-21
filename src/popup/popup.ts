import "./popup.css";
import { SETTINGS_SECTIONS } from "../features/settings/definitions";
import { getSettings, updateSettings, type Settings } from "../shared/state/settings";

let activeSectionId = SETTINGS_SECTIONS[0].id;

function createToggle(
    definition: typeof SETTINGS_SECTIONS[number]["settings"][number],
    settings: Settings,
): HTMLElement {
    const row = document.createElement("label");
    row.className = "popup-setting-row";
    const copy = document.createElement("span");
    const title = document.createElement("strong");
    const description = document.createElement("small");
    title.textContent = definition.title;
    description.textContent = definition.description;
    copy.append(title, description);

    const toggle = document.createElement("span");
    toggle.className = "popup-toggle";
    const input = document.createElement("input");
    input.type = "checkbox";
    input.checked = definition.read(settings);
    input.ariaLabel = definition.title;
    const indicator = document.createElement("span");
    indicator.className = "popup-toggle-indicator";
    toggle.append(input, indicator);
    input.addEventListener("change", () => void updateSettings(definition.write(input.checked)));
    row.append(copy, toggle);
    return row;
}

async function render(): Promise<void> {
    const root = document.querySelector<HTMLElement>("#app");
    if (!root) return;
    const settings = await getSettings();
    const active = SETTINGS_SECTIONS.find(section => section.id === activeSectionId) ?? SETTINGS_SECTIONS[0];

    const shell = document.createElement("main");
    shell.className = "popup-profile";
    const heading = document.createElement("header");
    heading.className = "popup-profile-heading";
    const title = document.createElement("h1");
    title.textContent = "Extra Domain Filters";
    const subtitle = document.createElement("p");
    subtitle.textContent = "Extension preferences";
    heading.append(title, subtitle);

    const layout = document.createElement("div");
    layout.className = "popup-profile-layout";
    const navigation = document.createElement("nav");
    const tabs = document.createElement("ul");
    for (const section of SETTINGS_SECTIONS) {
        const item = document.createElement("li");
        const button = document.createElement("button");
        const selected = section.id === active.id;
        button.type = "button";
        button.textContent = section.title;
        button.setAttribute("aria-selected", String(selected));
        button.addEventListener("click", () => {
            activeSectionId = section.id;
            void render();
        });
        item.append(button);
        tabs.append(item);
    }
    navigation.append(tabs);

    const content = document.createElement("section");
    content.className = "popup-settings-content";
    const sectionTitle = document.createElement("h2");
    sectionTitle.textContent = active.title;
    content.append(sectionTitle, ...active.settings.map(setting => createToggle(setting, settings)));
    layout.append(navigation, content);
    shell.append(heading, layout);
    root.replaceChildren(shell);
}

void render();
