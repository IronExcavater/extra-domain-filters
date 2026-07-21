import { observeUrlChanges, type PageContext } from "../../shared/platform/router";
import { getSettings, updateSettings, type Settings } from "../../shared/state/settings";
import type { DeepPartial } from "../../shared/utils/types";

const SETTINGS_QUERY = "extra-domain-filters";
const SETTINGS_VALUE = "settings";

type ToggleDefinition = {
    title: string;
    description: string;
    read(settings: Settings): boolean;
    write(value: boolean): DeepPartial<Settings>;
};

const TOGGLES: ToggleDefinition[] = [
    {
        title: "Extra Domain Filters",
        description: "Enable all extension features on Domain.",
        read: settings => settings.flags.enableExtension,
        write: enableExtension => ({ flags: { enableExtension } }),
    },
    {
        title: "Blacklist",
        description: "Show blacklist actions and hide blacklisted listings.",
        read: settings => settings.flags.enableBlacklist,
        write: enableBlacklist => ({ flags: { enableBlacklist } }),
    },
    {
        title: "Ad blocking",
        description: "Remove promoted placement cards from results.",
        read: settings => settings.flags.enableAdBlocking,
        write: enableAdBlocking => ({ flags: { enableAdBlocking } }),
    },
    {
        title: "Map matches",
        description: "Show preference matches on listing map pins.",
        read: settings => settings.flags.enableMapPins,
        write: enableMapPins => ({ flags: { enableMapPins } }),
    },
    {
        title: "Featured controls",
        description: "Add blacklist and pause controls to featured carousels.",
        read: settings => settings.flags.enableCarouselControls,
        write: enableCarouselControls => ({ flags: { enableCarouselControls } }),
    },
    {
        title: "Could-haves filter",
        description: "Show optional property preference filters.",
        read: settings => settings.filters.enabled.couldHaves,
        write: couldHaves => ({ filters: { enabled: { couldHaves } } }),
    },
    {
        title: "Exclude keywords filter",
        description: "Show custom keyword exclusions.",
        read: settings => settings.filters.enabled.excludeKeywords,
        write: excludeKeywords => ({ filters: { enabled: { excludeKeywords } } }),
    },
    {
        title: "Strata fees filter",
        description: "Show the maximum quarterly strata fee filter.",
        read: settings => settings.filters.enabled.strataFees,
        write: strataFees => ({ filters: { enabled: { strataFees } } }),
    },
    {
        title: "Property type exclusions",
        description: "Use unselected property types as exclusions.",
        read: settings => settings.filters.enabled.propertyTypes,
        write: propertyTypes => ({ filters: { enabled: { propertyTypes } } }),
    },
    {
        title: "Hide non-matches",
        description: "Hide listings that do not match any selected could-have.",
        read: settings => settings.filters.excludeWhenNoCouldHaveMatch,
        write: excludeWhenNoCouldHaveMatch => ({ filters: { excludeWhenNoCouldHaveMatch } }),
    },
    {
        title: "Match tags",
        description: "Show selected preference matches on listing cards.",
        read: settings => settings.display.showPreferenceTags,
        write: showPreferenceTags => ({ display: { showPreferenceTags } }),
    },
];

function isSettingsView(url = new URL(window.location.href)): boolean {
    return url.searchParams.get(SETTINGS_QUERY) === SETTINGS_VALUE;
}

function findProfileShell(): HTMLElement | undefined {
    return document.querySelector<HTMLElement>(".css-1nlilx1") ?? undefined;
}

function waitForProfileShell(signal: AbortSignal): Promise<HTMLElement> {
    const existing = findProfileShell();
    if (existing) return Promise.resolve(existing);

    return new Promise((resolve, reject) => {
        const observer = new MutationObserver(() => {
            const shell = findProfileShell();
            if (!shell) return;
            observer.disconnect();
            resolve(shell);
        });
        observer.observe(document.body, { childList: true, subtree: true });
        signal.addEventListener("abort", () => {
            observer.disconnect();
            reject(new DOMException("Unmounted", "AbortError"));
        }, { once: true });
    });
}

function createRow(template: HTMLElement, definition: ToggleDefinition, settings: Settings): HTMLElement {
    const row = template.cloneNode(true) as HTMLElement;
    const paragraphs = row.querySelectorAll<HTMLParagraphElement>("p");
    const input = row.querySelector<HTMLInputElement>('input[type="checkbox"]');
    const label = row.querySelector<HTMLLabelElement>("label");

    if (!input || !label || paragraphs.length < 2) throw new Error("Unable to clone a profile setting row");

    const id = `extra-domain-filters-${definition.title.toLowerCase().replaceAll(/[^a-z0-9]+/g, "-")}`;
    paragraphs[0].textContent = definition.title;
    paragraphs[1].textContent = definition.description;
    input.id = id;
    input.checked = definition.read(settings);
    label.htmlFor = id;
    input.addEventListener("change", () => void updateSettings(definition.write(input.checked)));
    return row;
}

function createPanel(shell: HTMLElement, settings: Settings): HTMLElement | undefined {
    const content = shell.querySelector<HTMLElement>(".css-1m3si3y");
    const sourceSection = content?.querySelector<HTMLElement>(".css-u4p3do");
    const sourceRow = sourceSection?.querySelector<HTMLElement>(".css-jbxx87");
    if (!content || !sourceSection || !sourceRow) return undefined;

    const panel = sourceSection.cloneNode(false) as HTMLElement;
    panel.dataset.extraDomainFiltersSettings = "true";
    const heading = document.createElement("h2");
    heading.className = content.querySelector("h2")?.className ?? "";
    heading.textContent = "Extra Domain Filters";
    panel.append(heading, ...TOGGLES.map(definition => createRow(sourceRow, definition, settings)));
    content.append(panel);
    return panel;
}

function bindSettingsTab(shell: HTMLElement, panel: HTMLElement, signal: AbortSignal): void {
    const list = shell.querySelector<HTMLUListElement>("nav ul");
    const source = list?.querySelector<HTMLLIElement>("li");
    const sourceButton = source?.querySelector<HTMLButtonElement>("button");
    if (!list || !source || !sourceButton) return;

    const item = source.cloneNode(true) as HTMLLIElement;
    const button = item.querySelector<HTMLButtonElement>("button");
    if (!button) return;

    item.dataset.extraDomainFiltersSettingsTab = "true";
    button.textContent = "Extension preferences";
    button.addEventListener("click", () => {
        const url = new URL(window.location.href);
        url.searchParams.set(SETTINGS_QUERY, SETTINGS_VALUE);
        history.pushState({}, "", url);
    });
    list.append(item);

    const updateView = (): void => {
        const active = isSettingsView();
        panel.hidden = !active;
        [...panel.parentElement!.children].forEach(child => {
            if (child === panel || child.closest("nav")) return;
            (child as HTMLElement).hidden = active;
        });
        button.className = active ? sourceButton.className : button.className;
    };

    list.addEventListener("click", event => {
        const target = event.target;
        if (!(target instanceof Element) || target.closest('[data-extra-domain-filters-settings-tab="true"]')) return;
        if (!target.closest("button")) return;
        const url = new URL(window.location.href);
        if (!url.searchParams.has(SETTINGS_QUERY)) return;
        url.searchParams.delete(SETTINGS_QUERY);
        history.pushState({}, "", url);
    });
    updateView();
    window.addEventListener("extra-domain-filters:url-change", updateView, { signal });
}

export async function mountProfileSettings(context: PageContext): Promise<void> {
    const shell = await waitForProfileShell(context.signal);
    if (shell.querySelector('[data-extra-domain-filters-settings="true"]')) return;

    const panel = createPanel(shell, await getSettings());
    if (!panel) return;
    bindSettingsTab(shell, panel, context.signal);
    observeUrlChanges(() => undefined, context.signal);
}
