import { waitForElement } from "../../shared/dom/wait";
import { observeUrlChanges, type PageContext } from "../../shared/platform/router";
import { getSettings, updateSettings, type Settings } from "../../shared/state/settings";
import { SETTINGS_SECTIONS, type SettingDefinition } from "./definitions";

const SETTINGS_QUERY = "extra-domain-filters";
const SETTINGS_VALUE = "settings";

function isSettingsView(url = new URL(window.location.href)): boolean {
    return url.searchParams.get(SETTINGS_QUERY) === SETTINGS_VALUE;
}

function findProfileShell(): HTMLElement | undefined {
    const nav = [...document.querySelectorAll<HTMLElement>("nav ul")]
        .find(candidate => /my details|account security/i.test(candidate.textContent ?? ""));
    return nav?.closest<HTMLElement>(".css-1nlilx1") ??
        nav?.parentElement?.parentElement ??
        undefined;
}

function waitForProfileShell(signal: AbortSignal): Promise<HTMLElement> {
    return waitForElement(findProfileShell, signal);
}

function createToggle(definition: SettingDefinition, settings: Settings): HTMLLabelElement {
    const toggle = document.createElement("label");
    const input = document.createElement("input");
    const inputWrapper = document.createElement("div");
    const indicator = document.createElement("div");
    const switchControl = document.createElement("span");
    const id = `extra-domain-filters-${definition.title.toLowerCase().replaceAll(/[^a-z0-9]+/g, "-")}`;

    toggle.className = "edf-settings-toggle";
    toggle.htmlFor = id;
    inputWrapper.className = "edf-settings-toggle-control";
    indicator.className = "edf-settings-toggle-indicator";
    switchControl.className = "edf-settings-toggle-switch";
    input.className = "edf-settings-toggle-input";
    input.type = "checkbox";
    input.id = id;
    input.checked = definition.read(settings);
    input.ariaLabel = definition.title;
    input.addEventListener("change", () => void updateSettings(definition.write(input.checked)));
    indicator.append(switchControl);
    inputWrapper.append(input, indicator);
    const label = document.createElement("div");
    label.className = "edf-settings-visually-hidden";
    label.textContent = definition.title;
    toggle.append(inputWrapper, label);
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
    row.replaceChildren(copy, createToggle(definition, settings));
    return row;
}

function createPanel(shell: HTMLElement, settings: Settings): HTMLElement | undefined {
    const nav = shell.querySelector("nav");
    const content = shell.querySelector<HTMLElement>(".css-1jo5qpx > div:last-child") ??
        (nav?.nextElementSibling instanceof HTMLElement ? nav.nextElementSibling : undefined);
    if (!content) return undefined;

    const panel = document.createElement("div");
    panel.className = "edf-settings-panel";
    panel.dataset.extraDomainFiltersSettings = "true";
    const introduction = document.createElement("div");
    introduction.className = "edf-settings-introduction";
    const heading = document.createElement("h2");
    heading.className = "edf-settings-title";
    heading.textContent = "Extra Domain Filters";
    const description = document.createElement("p");
    description.className = "edf-settings-description";
    description.textContent = "Manage how Extra Domain Filters changes your Domain experience.";
    introduction.append(heading, description);
    panel.append(introduction);
    for (const section of SETTINGS_SECTIONS) {
        const sectionElement = document.createElement("div");
        sectionElement.className = "edf-settings-section";
        const sectionHeading = document.createElement("h3");
        sectionHeading.className = "edf-settings-section-title";
        sectionHeading.textContent = section.title;
        sectionElement.append(sectionHeading, ...section.settings.map(definition => createRow(definition, settings)));
        panel.append(sectionElement);
    }
    content.append(panel);
    return panel;
}

function bindSettingsTab(shell: HTMLElement, panel: HTMLElement, signal: AbortSignal): void {
    const list = shell.querySelector<HTMLUListElement>("nav ul");
    const source = list?.querySelector<HTMLLIElement>("li");
    const sourceButton = source?.querySelector<HTMLButtonElement>("button");
    if (!list || !source || !sourceButton) return;

    const nativeButtons = [...list.querySelectorAll<HTMLButtonElement>(":scope > li > button")];
    const classCounts = new Map<string, number>();
    nativeButtons.forEach(nativeButton => {
        classCounts.set(nativeButton.className, (classCounts.get(nativeButton.className) ?? 0) + 1);
    });
    const inactiveClass = [...classCounts.entries()]
        .sort((first, second) => second[1] - first[1])[0]?.[0] ?? sourceButton.className;
    const activeClass = nativeButtons
        .find(nativeButton => nativeButton.className !== inactiveClass)
        ?.className ?? sourceButton.className;

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

    const setNativeTabsInactive = (): void => {
        nativeButtons.forEach(nativeButton => { nativeButton.className = inactiveClass; });
    };

    const updateView = (): void => {
        const active = isSettingsView();
        panel.hidden = !active;
        [...panel.parentElement!.children].forEach(child => {
            if (child === panel || child.closest("nav")) return;
            (child as HTMLElement).hidden = active;
        });
        if (active) {
            setNativeTabsInactive();
            button.className = activeClass;
        } else {
            button.className = inactiveClass;
        }
    };

    list.addEventListener("click", event => {
        const target = event.target;
        if (!(target instanceof Element) || target.closest('[data-extra-domain-filters-settings-tab="true"]')) return;
        const selectedButton = target.closest<HTMLButtonElement>("button");
        if (!selectedButton) return;
        const url = new URL(window.location.href);
        if (!url.searchParams.has(SETTINGS_QUERY)) return;
        url.searchParams.delete(SETTINGS_QUERY);
        history.pushState({}, "", url);
        setNativeTabsInactive();
        selectedButton.className = activeClass;
    });
    updateView();
    window.addEventListener("extra-domain-filters:url-change", updateView, { signal });
}

export async function mountProfileSettings(context: PageContext): Promise<void> {
    await waitForProfileShell(context.signal);

    let frame: number | undefined;
    const inject = async (): Promise<void> => {
        const shell = findProfileShell();
        if (!shell || shell.querySelector('[data-extra-domain-filters-settings="true"]')) return;

        const panel = createPanel(shell, await getSettings());
        if (panel) bindSettingsTab(shell, panel, context.signal);
    };
    const schedule = (): void => {
        if (frame !== undefined || context.signal.aborted) return;
        frame = requestAnimationFrame(() => {
            frame = undefined;
            void inject();
        });
    };
    const observer = new MutationObserver(schedule);
    observer.observe(document.body, { childList: true, subtree: true });
    await inject();

    context.signal.addEventListener("abort", () => {
        observer.disconnect();
        if (frame !== undefined) cancelAnimationFrame(frame);
    }, { once: true });
    observeUrlChanges(() => undefined, context.signal);
}
