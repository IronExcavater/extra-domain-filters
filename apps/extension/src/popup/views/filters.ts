import { STRATA_MAX } from "../../domain/matching";
import { createSettingRow, createSettingsSection } from "../../features/settings/view";
import { onStorageChange } from "../../platform/storage";
import {
    addCouldHave,
    getSettings,
    isDefaultCouldHaveList,
    removeCouldHave,
    resetCouldHaves,
    setCouldHaveSelected,
    updateSettings,
    type Settings,
} from "../../state/settings";
import { createSvgIcon, type IconRenderer } from "../../ui/elements";
import {
    replaceWithCheckIcon,
    replaceWithCloseIcon,
    replaceWithCouldHavesFilterIcon,
    replaceWithExcludeKeywordsFilterIcon,
    replaceWithPopupPlusIcon,
    replaceWithStrataFilterIcon,
} from "../../ui/icons";

interface FiltersViewOptions {
    settings: Settings;
    signal: AbortSignal;
}

function formatStrata(value: number): string {
    return value >= STRATA_MAX
        ? "No limit"
        : `Up to ${value.toLocaleString("en-AU", { currency: "AUD", maximumFractionDigits: 0, style: "currency" })} a quarter`;
}

function createCard(title: string, description: string, icon: IconRenderer): {
    actions: HTMLElement;
    body: HTMLElement;
    card: HTMLElement;
} {
    const card = document.createElement("section");
    const head = document.createElement("div");
    const heading = document.createElement("h2");
    const actions = document.createElement("div");
    const copy = document.createElement("p");
    const body = document.createElement("div");

    card.className = "edf-settings-section edf-filters-card";
    head.className = "edf-filters-card-head";
    heading.className = "edf-settings-section-title";
    heading.append(createSvgIcon(icon, "edf-filters-card-icon"), title);
    actions.className = "edf-filters-card-actions";
    copy.className = "edf-settings-section-description";
    copy.textContent = description;
    body.className = "edf-filters-card-body";
    head.append(heading, actions);
    card.append(head, copy, body);
    return { actions, body, card };
}

/** A text field with an Add button; Enter adds too. */
function createAdder(placeholder: string, label: string, onAdd: (text: string) => Promise<unknown>): HTMLElement {
    const adder = document.createElement("div");
    const input = document.createElement("input");
    const button = document.createElement("button");

    adder.className = "edf-filters-adder";
    input.className = "edf-filters-input";
    input.type = "text";
    input.maxLength = 60;
    input.placeholder = placeholder;
    input.ariaLabel = label;
    button.type = "button";
    button.className = "edf-filters-add";
    button.append(createSvgIcon(replaceWithPopupPlusIcon), "Add");
    const submit = async (): Promise<void> => {
        const text = input.value.trim();
        if (!text) {
            input.focus();
            return;
        }
        input.value = "";
        await onAdd(text);
        input.focus();
    };
    input.addEventListener("keydown", event => {
        if (event.key !== "Enter") return;
        event.preventDefault();
        void submit();
    });
    button.addEventListener("click", () => void submit());
    adder.append(input, button);
    return adder;
}

function createChip(options: {
    label: string;
    onRemove(): Promise<unknown>;
    onToggle?(): Promise<unknown>;
    selected?: boolean;
}): HTMLElement {
    const chip = document.createElement("span");
    const main = document.createElement(options.onToggle ? "button" : "span");
    const remove = document.createElement("button");

    chip.className = "edf-filters-chip";
    main.className = "edf-filters-chip-label";
    if (main instanceof HTMLButtonElement) {
        main.type = "button";
        main.ariaPressed = String(Boolean(options.selected));
        main.addEventListener("click", () => void options.onToggle?.());
        main.append(createSvgIcon(replaceWithCheckIcon, "edf-filters-chip-check"));
    }
    main.append(options.label);
    remove.type = "button";
    remove.className = "edf-filters-chip-remove";
    remove.ariaLabel = `Remove ${options.label}`;
    remove.append(createSvgIcon(replaceWithCloseIcon));
    remove.addEventListener("click", () => {
        chip.dataset.removing = "true";
        void options.onRemove();
    });
    chip.dataset.selected = String(Boolean(options.selected));
    chip.append(main, remove);
    return chip;
}

function createEmpty(text: string): HTMLElement {
    const empty = document.createElement("p");
    empty.className = "edf-filters-empty";
    empty.textContent = text;
    return empty;
}

/**
 * The popup's Filters page: everything the extension filters on, editable in one place and
 * applied immediately. Domain's filter panel offers the same controls next to its own.
 */
export function createFiltersView(options: FiltersViewOptions): HTMLElement {
    let settings = options.settings;
    // Every change re-reads settings and redraws, without waiting for the storage event.
    const apply = async (change: Promise<unknown>): Promise<void> => {
        await change;
        if (options.signal.aborted) return;
        settings = await getSettings();
        render();
    };
    const content = document.createElement("section");
    const intro = document.createElement("header");
    const title = document.createElement("h1");
    const lede = document.createElement("p");

    content.className = "edf-popup-content edf-popup-filters";
    intro.className = "edf-popup-page-header";
    title.textContent = "Filters";
    lede.textContent = "Applied to every Domain search, on top of Domain's own filters. Changes apply straight away.";
    intro.append(title, lede);

    // Could-haves
    const couldHaves = createCard(
        "Could-haves",
        "Tick the extras you'd like. Listings that mention one get a gold tag in results and a gold pin on the map.",
        replaceWithCouldHavesFilterIcon,
    );
    const couldHaveChips = document.createElement("div");
    const reset = document.createElement("button");
    couldHaveChips.className = "edf-filters-chips";
    couldHaveChips.setAttribute("role", "group");
    couldHaveChips.ariaLabel = "Could-haves";
    reset.type = "button";
    reset.className = "edf-filters-text-action";
    reset.textContent = "Reset to defaults";
    reset.addEventListener("click", () => void apply(resetCouldHaves()));
    couldHaves.actions.append(reset);
    const strictHost = document.createElement("div");
    couldHaves.body.append(
        couldHaveChips,
        createAdder("Add a could-have, e.g. solar or ocean view / sea view", "Add a could-have", text => apply(addCouldHave(text))),
        strictHost,
    );

    // Exclude keywords
    const keywords = createCard(
        "Exclude keywords",
        "Listings whose description mentions any of these are hidden.",
        replaceWithExcludeKeywordsFilterIcon,
    );
    const keywordChips = document.createElement("div");
    keywordChips.className = "edf-filters-chips";
    keywords.body.append(
        keywordChips,
        createAdder("Add a keyword, e.g. studio", "Add an excluded keyword", async text => {
            const next = [...new Set([...settings.filters.excludeKeywords, text])];
            await apply(updateSettings({ filters: { excludeKeywords: next } }));
        }),
    );

    // Strata
    const strata = createCard(
        "Strata fees",
        "Hide listings whose quarterly strata or body corporate fee is above your maximum.",
        replaceWithStrataFilterIcon,
    );
    const strataValue = document.createElement("output");
    const strataInput = document.createElement("input");
    strataValue.className = "edf-filters-range-value";
    strataInput.className = "edf-filters-range";
    strataInput.type = "range";
    strataInput.min = "0";
    strataInput.max = String(STRATA_MAX);
    strataInput.step = "50";
    strataInput.ariaLabel = "Maximum quarterly strata fee";
    strataInput.addEventListener("input", () => {
        strataValue.textContent = formatStrata(Number(strataInput.value));
    });
    strataInput.addEventListener("change", () =>
        void apply(updateSettings({ filters: { strataMaxDollars: Number(strataInput.value) } })));
    strata.body.append(strataValue, strataInput);

    // Property types
    const types = createCard(
        "Property types",
        "Types you untick in Domain's property type filter are hidden. Remove one here to show it again.",
        replaceWithExcludeKeywordsFilterIcon,
    );
    const typeChips = document.createElement("div");
    typeChips.className = "edf-filters-chips";
    types.body.append(typeChips);

    const render = (): void => {
        const { filters } = settings;
        const selected = new Set(filters.couldHaveRuleIds);
        couldHaveChips.replaceChildren(...filters.couldHaveOptions.map(option => createChip({
            label: option.label,
            onRemove: () => apply(removeCouldHave(option.id)),
            onToggle: () => apply(setCouldHaveSelected(option.id, !selected.has(option.id))),
            selected: selected.has(option.id),
        })));
        if (filters.couldHaveOptions.length === 0) {
            couldHaveChips.append(createEmpty("No could-haves yet. Add one below, or reset to the defaults."));
        }
        reset.hidden = isDefaultCouldHaveList(filters.couldHaveOptions);
        strictHost.replaceChildren(createSettingRow({
            description: "Only show listings that mention at least one ticked could-have.",
            kind: "toggle",
            read: current => current.filters.excludeWhenNoCouldHaveMatch,
            title: "Hide listings with none of them",
            write: excludeWhenNoCouldHaveMatch => ({ filters: { excludeWhenNoCouldHaveMatch } }),
        }, settings));

        keywordChips.replaceChildren(...filters.excludeKeywords.map(keyword => createChip({
            label: keyword,
            onRemove: () => apply(updateSettings({
                filters: { excludeKeywords: settings.filters.excludeKeywords.filter(existing => existing !== keyword) },
            })),
        })));
        if (filters.excludeKeywords.length === 0) keywordChips.append(createEmpty("Nothing excluded."));

        if (document.activeElement !== strataInput) strataInput.value = String(filters.strataMaxDollars);
        strataValue.textContent = formatStrata(Number(strataInput.value));

        typeChips.replaceChildren(...filters.excludePropertyKeywords.map(type => createChip({
            label: type,
            onRemove: () => apply(updateSettings({
                filters: {
                    excludePropertyKeywords: settings.filters.excludePropertyKeywords.filter(existing => existing !== type),
                },
            })),
        })));
        if (filters.excludePropertyKeywords.length === 0) {
            typeChips.append(createEmpty("Every property type is shown."));
        }
    };

    render();
    const domainSection = createSettingsSection("filters", settings, "h2");
    content.append(intro, couldHaves.card, keywords.card, strata.card, types.card, ...(domainSection ? [domainSection] : []));
    const unwatch = onStorageChange<Settings>("settings", next => {
        if (!next?.filters?.couldHaveOptions) return;
        settings = next;
        render();
    });
    options.signal.addEventListener("abort", unwatch, { once: true });
    return content;
}
