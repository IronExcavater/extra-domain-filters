import "./popup.css";
import { getSettings, updateSettings, type Settings } from "../shared/state/settings";
import type { DeepPartial } from "../shared/utils/types";

type Toggle = {
    label: string;
    description?: string;
    read(settings: Settings): boolean;
    write(value: boolean): DeepPartial<Settings>;
};

const toggles: Toggle[] = [
    { label: "Extension", read: settings => settings.flags.enableExtension, write: enableExtension => ({ flags: { enableExtension } }) },
    { label: "Blacklist", read: settings => settings.flags.enableBlacklist, write: enableBlacklist => ({ flags: { enableBlacklist } }) },
    { label: "Ad blocking", read: settings => settings.flags.enableAdBlocking, write: enableAdBlocking => ({ flags: { enableAdBlocking } }) },
    { label: "Map matches", read: settings => settings.flags.enableMapPins, write: enableMapPins => ({ flags: { enableMapPins } }) },
    { label: "Featured controls", read: settings => settings.flags.enableCarouselControls, write: enableCarouselControls => ({ flags: { enableCarouselControls } }) },
    { label: "Could-haves", read: settings => settings.filters.enabled.couldHaves, write: couldHaves => ({ filters: { enabled: { couldHaves } } }) },
    { label: "Hide non-matches", read: settings => settings.filters.excludeWhenNoCouldHaveMatch, write: excludeWhenNoCouldHaveMatch => ({ filters: { excludeWhenNoCouldHaveMatch } }) },
    { label: "Match tags", read: settings => settings.display.showPreferenceTags, write: showPreferenceTags => ({ display: { showPreferenceTags } }) },
];

function createToggle(definition: Toggle, settings: Settings): HTMLLabelElement {
    const row = document.createElement("label");
    row.className = "setting";
    const copy = document.createElement("span");
    copy.textContent = definition.label;
    const input = document.createElement("input");
    input.type = "checkbox";
    input.checked = definition.read(settings);
    input.addEventListener("change", () => void updateSettings(definition.write(input.checked)));
    row.append(copy, input);
    return row;
}

async function render(): Promise<void> {
    const root = document.querySelector<HTMLElement>("#app");
    if (!root) return;
    const settings = await getSettings();
    const heading = document.createElement("h1");
    heading.textContent = "Extra Domain Filters";
    const description = document.createElement("p");
    description.textContent = "Extension preferences";
    const form = document.createElement("section");
    form.append(...toggles.map(toggle => createToggle(toggle, settings)));
    root.replaceChildren(heading, description, form);
}

void render();
