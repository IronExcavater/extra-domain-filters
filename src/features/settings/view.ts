import { updateSettings, type Settings } from "../../shared/state/settings";
import type { SettingDefinition } from "./definitions";
import { SETTINGS_SECTIONS } from "./definitions";

type HeadingTag = "h1" | "h2" | "h3";

interface SettingsViewOptions {
    sectionHeading: HeadingTag;
    titleHeading: HeadingTag;
}

function createToggle(definition: SettingDefinition, settings: Settings): HTMLLabelElement {
    const toggle = document.createElement("label");
    const control = document.createElement("div");
    const input = document.createElement("input");
    const indicator = document.createElement("div");
    const stateLabel = document.createElement("span");
    const switchControl = document.createElement("span");
    const id = `extra-domain-filters-${definition.title.toLowerCase().replaceAll(/[^a-z0-9]+/g, "-")}`;

    toggle.className = "edf-settings-toggle";
    toggle.htmlFor = id;
    control.className = "edf-settings-toggle-control";
    input.className = "edf-settings-toggle-input";
    input.type = "checkbox";
    input.id = id;
    input.checked = definition.read(settings);
    input.ariaLabel = definition.title;
    indicator.className = "edf-settings-toggle-indicator";
    stateLabel.className = "edf-settings-toggle-label";
    switchControl.className = "edf-settings-toggle-switch";

    const syncLabel = (): void => { stateLabel.textContent = input.checked ? "On" : "Off"; };
    syncLabel();
    input.addEventListener("change", () => {
        syncLabel();
        void updateSettings(definition.write(input.checked));
    });
    indicator.append(stateLabel, switchControl);
    control.append(input, indicator);
    toggle.append(control);
    return toggle;
}

function createRow(definition: SettingDefinition, settings: Settings): HTMLElement {
    const row = document.createElement("div");
    const copy = document.createElement("div");
    const title = document.createElement("p");
    const description = document.createElement("p");

    row.className = "edf-settings-row";
    copy.className = "edf-settings-copy";
    title.className = "edf-settings-row-title";
    description.className = "edf-settings-row-description";
    title.textContent = definition.title;
    description.textContent = definition.description;
    copy.append(title, description);
    row.append(copy, createToggle(definition, settings));
    return row;
}

function createHeading(tag: HeadingTag, className: string, text: string): HTMLElement {
    const heading = document.createElement(tag);
    heading.className = className;
    heading.textContent = text;
    return heading;
}

export function createSettingsContent(settings: Settings, options: SettingsViewOptions): DocumentFragment {
    const content = document.createDocumentFragment();
    const introduction = document.createElement("div");
    const description = document.createElement("p");

    introduction.className = "edf-settings-introduction";
    description.className = "edf-settings-description";
    description.textContent = "Manage how Extra Domain Filters changes your Domain experience.";
    introduction.append(
        createHeading(options.titleHeading, "edf-settings-title", "Extra Domain Filters"),
        description,
    );
    content.append(introduction);

    for (const section of SETTINGS_SECTIONS) {
        const card = document.createElement("section");
        card.className = "edf-settings-section";
        card.append(
            createHeading(options.sectionHeading, "edf-settings-section-title", section.title),
            ...section.settings.map(definition => createRow(definition, settings)),
        );
        content.append(card);
    }

    return content;
}
