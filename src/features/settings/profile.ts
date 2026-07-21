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

    toggle.className = "domain-checkbox is-toggle edf-profile-toggle";
    toggle.htmlFor = id;
    inputWrapper.className = "domain-checkbox__input domain-checkbox--toggle";
    indicator.className = "domain-checkbox__control-indicator";
    switchControl.className = "domain-checkbox__control-switch";
    input.className = "domain-checkbox__checkbox";
    input.type = "checkbox";
    input.id = id;
    input.checked = definition.read(settings);
    input.ariaLabel = definition.title;
    input.addEventListener("change", () => void updateSettings(definition.write(input.checked)));
    indicator.append(switchControl);
    inputWrapper.append(input, indicator);
    toggle.append(inputWrapper);
    return toggle;
}

function createRow(template: HTMLElement, definition: SettingDefinition, settings: Settings): HTMLElement {
    const row = template.cloneNode(true) as HTMLElement;
    const copy = document.createElement("div");
    const title = document.createElement("p");
    const description = document.createElement("p");

    title.className = row.querySelector("p")?.className ?? "";
    description.className = "edf-profile-setting-description";
    title.textContent = definition.title;
    description.textContent = definition.description;
    copy.append(title, description);
    row.classList.add("edf-profile-setting-row");
    row.replaceChildren(copy, createToggle(definition, settings));
    return row;
}

function createPanel(shell: HTMLElement, settings: Settings): HTMLElement | undefined {
    const nav = shell.querySelector("nav");
    const content = shell.querySelector<HTMLElement>(".css-1m3si3y") ??
        (nav?.parentElement?.nextElementSibling instanceof HTMLElement
            ? nav.parentElement.nextElementSibling
            : undefined);
    const sourceSection = content?.querySelector<HTMLElement>(".css-u4p3do") ?? content;
    const sourceRow = sourceSection?.querySelector<HTMLElement>(".css-hyniss, .css-jbxx87") ??
        sourceSection?.querySelector<HTMLElement>("div") ??
        sourceSection;
    if (!content || !sourceSection || !sourceRow) return undefined;

    const panel = sourceSection.cloneNode(false) as HTMLElement;
    panel.dataset.extraDomainFiltersSettings = "true";
    const heading = document.createElement("h2");
    heading.className = content.querySelector("h2")?.className ?? "";
    heading.textContent = "Extra Domain Filters";
    panel.append(heading);
    for (const section of SETTINGS_SECTIONS) {
        const sectionHeading = document.createElement("h3");
        sectionHeading.className = sourceSection.querySelector("h3")?.className ?? "";
        sectionHeading.textContent = section.title;
        panel.append(sectionHeading, ...section.settings.map(definition => createRow(sourceRow, definition, settings)));
    }
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
