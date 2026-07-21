import { PREFERENCES, STRATA_MAX } from "../domain/matching";
import { createSharedFilterUrl } from "../features/filters/searchParams";
import { copyText } from "../shared/platform/clipboard";
import { getFilterPresets, removeFilterPreset, saveFilterPreset, setFilterPresetPinned } from "../shared/state/presets";
import { getSettings, toggleListId, updateSettings, type Settings } from "../shared/state/settings";

function createHeading(text: string, className: string): HTMLHeadingElement {
    const heading = document.createElement("h1");
    heading.className = className;
    heading.textContent = text;
    return heading;
}

function createPreference(settings: Settings, id: string, labelText: string): HTMLLabelElement {
    const label = document.createElement("label");
    const input = document.createElement("input");
    const text = document.createElement("span");

    label.className = "edf-popup-filter-choice";
    input.type = "checkbox";
    input.checked = settings.filters.couldHaveRuleIds.includes(id);
    text.textContent = labelText;
    input.addEventListener("change", () => {
        void updateSettings({
            filters: {
                couldHaveRuleIds: toggleListId(
                    settings.filters.couldHaveRuleIds,
                    id,
                    input.checked,
                ),
            },
        });
    });
    label.append(input, text);
    return label;
}

function createKeywordInput(settings: Settings): HTMLLabelElement {
    const label = document.createElement("label");
    const text = document.createElement("span");
    const input = document.createElement("input");

    label.className = "edf-popup-filter-field";
    text.textContent = "Exclude keywords";
    input.value = settings.filters.excludeKeywords.join(", ");
    input.placeholder = "e.g. studio, granny flat";
    input.addEventListener("change", () => {
        void updateSettings({
            filters: {
                excludeKeywords: input.value.split(",").map(value => value.trim()).filter(Boolean),
            },
        });
    });
    label.append(text, input);
    return label;
}

function createStrataInput(settings: Settings): HTMLLabelElement {
    const label = document.createElement("label");
    const text = document.createElement("span");
    const input = document.createElement("input");

    label.className = "edf-popup-filter-field";
    text.textContent = "Maximum quarterly strata fee";
    input.type = "number";
    input.min = "0";
    input.max = String(STRATA_MAX);
    input.step = "50";
    input.value = String(settings.filters.strataMaxDollars);
    input.addEventListener("change", () => {
        const value = Math.min(STRATA_MAX, Math.max(0, Number(input.value) || STRATA_MAX));
        input.value = String(value);
        void updateSettings({ filters: { strataMaxDollars: value } });
    });
    label.append(text, input);
    return label;
}

function createToggle(settings: Settings): HTMLLabelElement {
    const label = document.createElement("label");
    const input = document.createElement("input");
    const copy = document.createElement("span");
    const title = document.createElement("strong");
    const description = document.createElement("small");

    label.className = "edf-popup-filter-toggle";
    input.type = "checkbox";
    input.checked = settings.filters.excludeWhenNoCouldHaveMatch;
    title.textContent = "Only show could-have matches";
    description.textContent = "Hide results without a selected optional preference.";
    copy.append(title, description);
    input.addEventListener("change", () => {
        void updateSettings({
            filters: { excludeWhenNoCouldHaveMatch: input.checked },
        });
    });
    label.append(copy, input);
    return label;
}

function createShareButton(settings: Settings): HTMLButtonElement {
    const button = document.createElement("button");
    button.className = "edf-settings-action";
    button.type = "button";
    button.textContent = "Share filters";
    button.addEventListener("click", async () => {
        await copyText(createSharedFilterUrl(settings).href);
        button.textContent = "Copied";
        button.blur();
        window.setTimeout(() => { button.textContent = "Share filters"; }, 1400);
    });
    return button;
}

function createPresetControls(settings: Settings): HTMLElement {
    const section = document.createElement("section");
    const heading = document.createElement("h2");
    const form = document.createElement("div");
    const name = document.createElement("input");
    const save = document.createElement("button");
    const list = document.createElement("div");

    section.className = "edf-popup-filter-section";
    heading.className = "edf-popup-filter-title";
    heading.textContent = "Saved presets";
    form.className = "edf-popup-preset-form";
    name.placeholder = "Preset name";
    save.className = "edf-settings-action";
    save.type = "button";
    save.textContent = "Save preset";
    save.addEventListener("click", async () => {
        save.disabled = true;
        await saveFilterPreset(name.value, settings.filters);
        name.value = "";
        save.disabled = false;
        await renderPresets(list);
    });
    form.append(name, save);
    section.append(heading, form, list);
    void renderPresets(list);
    return section;
}

async function renderPresets(container: HTMLElement): Promise<void> {
    const presets = await getFilterPresets();
    const content = document.createDocumentFragment();
    if (presets.length === 0) {
        const empty = document.createElement("p");
        empty.className = "edf-popup-preset-empty";
        empty.textContent = "Saved presets can be pinned to Domain's recent searches.";
        content.append(empty);
    }

    for (const preset of presets) {
        const row = document.createElement("div");
        const title = document.createElement("span");
        const pin = document.createElement("button");
        const remove = document.createElement("button");

        row.className = "edf-popup-preset-row";
        title.textContent = preset.name;
        pin.className = "edf-popup-preset-button";
        pin.type = "button";
        pin.textContent = preset.pinned ? "Unpin" : "Pin";
        pin.addEventListener("click", async () => {
            await setFilterPresetPinned(preset.id, !preset.pinned);
            await renderPresets(container);
        });
        remove.className = "edf-popup-preset-button";
        remove.type = "button";
        remove.textContent = "Remove";
        remove.addEventListener("click", async () => {
            await removeFilterPreset(preset.id);
            await renderPresets(container);
        });
        row.append(title, pin, remove);
        content.append(row);
    }
    container.replaceChildren(content);
}

export async function createFiltersContent(): Promise<HTMLElement> {
    const settings = await getSettings();
    const content = document.createElement("section");
    const header = document.createElement("div");
    const description = document.createElement("p");
    const preferences = document.createElement("section");
    const preferenceTitle = document.createElement("h2");
    const grid = document.createElement("div");
    const details = document.createElement("section");

    content.className = "edf-popup-content edf-popup-filters";
    header.className = "edf-popup-view-header";
    description.className = "edf-popup-view-description";
    description.textContent = "Preferences apply on Domain search pages and can be shared as a link.";
    header.append(createHeading("Filters", "edf-popup-view-title"), description, createShareButton(settings));

    preferences.className = "edf-popup-filter-section";
    preferenceTitle.className = "edf-popup-filter-title";
    preferenceTitle.textContent = "Could-haves";
    grid.className = "edf-popup-filter-choice-grid";
    grid.append(...PREFERENCES.map(preference => createPreference(settings, preference.id, preference.label)));
    preferences.append(preferenceTitle, grid);

    details.className = "edf-popup-filter-section";
    details.append(createKeywordInput(settings), createStrataInput(settings), createToggle(settings));
    content.append(header, preferences, details, createPresetControls(settings));
    return content;
}
