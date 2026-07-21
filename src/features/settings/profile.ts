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

function createRow(template: HTMLElement, definition: SettingDefinition, settings: Settings): HTMLElement {
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
    const nav = shell.querySelector("nav");
    const content = shell.querySelector<HTMLElement>(".css-1m3si3y") ??
        (nav?.parentElement?.nextElementSibling?.querySelector<HTMLElement>("div"));
    const sourceSection = content?.querySelector<HTMLElement>(".css-u4p3do");
    const sourceRow = sourceSection?.querySelector<HTMLElement>(".css-jbxx87");
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
    const shell = await waitForProfileShell(context.signal);
    if (shell.querySelector('[data-extra-domain-filters-settings="true"]')) return;

    const panel = createPanel(shell, await getSettings());
    if (!panel) return;
    bindSettingsTab(shell, panel, context.signal);
    observeUrlChanges(() => undefined, context.signal);
}
