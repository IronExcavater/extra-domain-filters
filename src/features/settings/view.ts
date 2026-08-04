import { getAccountState, signIn, signOut } from "../../domain/account/client";
import type { AccountState } from "../../domain/account/model";
import { setBlacklist } from "../../domain/blacklist/store";
import { clearListingCache } from "../../domain/listings/cache";
import { trackTelemetry } from "../../domain/telemetry/client";
import { updateSettings, type Settings } from "../../shared/state/settings";
import { createSvgIcon } from "../../shared/ui/elements";
import {
    replaceWithChromeWebStoreIcon,
    replaceWithExternalIcon,
    replaceWithGithubIcon,
    replaceWithItchioIcon,
    replaceWithLinkedInIcon,
} from "../../shared/ui/icons";
import { createDropdownControl } from "../../shared/ui/sort";
import { showToast, type ToastScope } from "../../shared/ui/toast";
import type { ChoiceSettingDefinition, SettingDefinition, SettingsControlDefinition } from "./definitions";
import { SETTINGS_SECTIONS } from "./definitions";

type HeadingTag = "h1" | "h2" | "h3";

interface SettingsViewOptions {
    includeIntroduction?: boolean;
    sectionHeading: HeadingTag;
    titleHeading: HeadingTag;
    toastScope?: ToastScope;
}

interface MaintenanceAction {
    description: string;
    label: string;
    run(): Promise<void>;
    title: string;
}

interface SupportLink {
    href: string;
    icon: "chrome-web-store" | "github" | "itchio" | "linked-in";
    title: string;
}

interface SupportGroup {
    links: readonly SupportLink[];
    title: string;
}

const MAINTENANCE_ACTIONS: MaintenanceAction[] = [
    {
        title: "Clear listing cache",
        description: "Remove cached listing details and images. They will be collected again when needed.",
        label: "Clear cache",
        run: clearListingCache,
    },
    {
        title: "Clear blacklist",
        description: "Remove every listing from the extension blacklist.",
        label: "Clear blacklist",
        run: () => setBlacklist([]),
    },
];

const SUPPORT_GROUPS: readonly SupportGroup[] = [
    {
        title: "",
        links: [
            {
                title: "Source code",
                href: "https://github.com/IronExcavater/extra-domain-filters",
                icon: "github",
            },
            {
                title: "Chrome Web Store",
                href: "https://chromewebstore.google.com/detail/extra-domain-filters/opblibcobnkicpdjkinngfcbjjnjldkg",
                icon: "chrome-web-store",
            },
            {
                title: "Feedback and issues",
                href: "https://github.com/IronExcavater/extra-domain-filters/issues/new/choose",
                icon: "github",
            },
        ],
    },
    {
        title: "",
        links: [
            {
                title: "LinkedIn",
                href: "https://www.linkedin.com/in/niclas-rogulski-459845302",
                icon: "linked-in",
            },
            {
                title: "GitHub",
                href: "https://github.com/IronExcavater/IronExcavater",
                icon: "github",
            },
            {
                title: "itch.io",
                href: "https://niclas-rogulski.itch.io",
                icon: "itchio",
            },
        ],
    },
];

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
    input.checked = definition.read(settings) === true;
    input.ariaLabel = definition.title;
    indicator.className = "edf-settings-toggle-indicator";
    stateLabel.className = "edf-settings-toggle-label";
    switchControl.className = "edf-settings-toggle-switch";

    const syncLabel = (): void => { stateLabel.textContent = input.checked ? "On" : "Off"; };
    syncLabel();
    input.addEventListener("change", () => {
        syncLabel();
        void updateSettings(definition.write(input.checked));
        void trackTelemetry({ name: "feature_used", feature: "settings" });
    });
    indicator.append(stateLabel, switchControl);
    control.append(input, indicator);
    toggle.append(control);
    return toggle;
}

function createChoice(definition: ChoiceSettingDefinition, settings: Settings): HTMLElement {
    const control = createDropdownControl({
        ariaLabel: definition.title,
        onChange: value => {
            void updateSettings(definition.write(value));
            void trackTelemetry({ name: "feature_used", feature: "settings" });
        },
        options: definition.options.map(option => [option.value, option.label] as const),
        value: definition.read(settings),
    });

    control.element.classList.add("edf-settings-choice");
    return control.element;
}

function createRow(definition: SettingsControlDefinition, settings: Settings): HTMLElement {
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
    row.append(copy, definition.kind === "choice"
        ? createChoice(definition, settings)
        : createToggle(definition, settings));
    return row;
}

function createActionRow(action: MaintenanceAction, toastScope: ToastScope): HTMLElement {
    const row = document.createElement("div");
    const copy = document.createElement("div");
    const title = document.createElement("p");
    const description = document.createElement("p");
    const button = document.createElement("button");

    row.className = "edf-settings-row";
    copy.className = "edf-settings-copy";
    title.className = "edf-settings-row-title";
    description.className = "edf-settings-row-description";
    button.className = "edf-settings-action edf-domain-button";
    button.type = "button";
    title.textContent = action.title;
    description.textContent = action.description;
    button.textContent = action.label;
    button.addEventListener("click", async () => {
        button.disabled = true;
        try {
            await action.run();
            showToast(`${action.title} cleared`, toastScope);
        } finally {
            button.disabled = false;
        }
    });
    copy.append(title, description);
    row.append(copy, button);
    return row;
}

function createHeading(tag: HeadingTag, className: string, text: string): HTMLElement {
    const heading = document.createElement(tag);
    heading.className = className;
    heading.textContent = text;
    return heading;
}

function createSupportLink(link: SupportLink): HTMLElement {
    const row = document.createElement("a");
    const icon = document.createElement("span");
    const copy = document.createElement("span");
    const title = document.createElement("span");
    const external = document.createElement("span");

    row.className = "edf-settings-support-link";
    row.href = link.href;
    row.rel = "noreferrer";
    row.target = "_blank";
    row.ariaLabel = `${link.title} (opens in a new tab)`;
    row.addEventListener("click", () => {
        void trackTelemetry({ name: "feature_used", feature: "support_link" });
    });
    icon.className = "edf-settings-support-icon";
    copy.className = "edf-settings-support-copy";
    title.className = "edf-settings-support-title";
    external.className = "edf-settings-support-external";
    title.textContent = link.title;
    const iconRenderer = {
        "chrome-web-store": replaceWithChromeWebStoreIcon,
        github: replaceWithGithubIcon,
        itchio: replaceWithItchioIcon,
        "linked-in": replaceWithLinkedInIcon,
    }[link.icon];
    icon.append(createSvgIcon(iconRenderer));
    external.append(createSvgIcon(replaceWithExternalIcon));
    copy.append(title);
    row.append(icon, copy, external);
    return row;
}

function createSupportGroup(group: SupportGroup): HTMLElement {
    const section = document.createElement("div");
    const title = document.createElement("h3");
    const links = document.createElement("div");

    section.className = "edf-settings-support-group";
    title.className = "edf-settings-support-group-title";
    links.className = "edf-settings-support-actions";
    title.textContent = group.title;
    links.append(...group.links.map(createSupportLink));
    if (group.title) section.append(title);
    section.append(links);
    return section;
}

function createAccountSection(sectionHeading: HeadingTag, toastScope: ToastScope): HTMLElement {
    const section = document.createElement("section");
    const row = document.createElement("div");
    const copy = document.createElement("div");
    const title = document.createElement("p");
    const description = document.createElement("p");
    const button = document.createElement("button");

    section.className = "edf-settings-section";
    row.className = "edf-settings-row";
    copy.className = "edf-settings-copy";
    title.className = "edf-settings-row-title";
    description.className = "edf-settings-row-description";
    button.className = "edf-settings-action edf-domain-button";
    button.type = "button";
    title.textContent = "Google account";
    description.textContent = "Checking account status...";
    button.disabled = true;
    button.textContent = "Sign in";

    const render = (state: AccountState): void => {
        button.disabled = state.status === "unavailable";
        button.textContent = state.status === "signed-in" ? "Sign out" : "Sign in";
        description.textContent = state.status === "signed-in"
            ? `Syncing as ${state.profile?.email ?? state.profile?.displayName ?? "Google user"}.`
            : state.status === "unavailable"
                ? "Account sync is not configured in this build."
                : "Sign in to sync your extension data across devices.";
    };

    button.addEventListener("click", async () => {
        button.disabled = true;

        try {
            const current = await getAccountState();
            render(current.status === "signed-in" ? await signOut() : await signIn());
            showToast(current.status === "signed-in" ? "Signed out" : "Signed in", toastScope);
        } catch (error) {
            showToast(error instanceof Error ? error.message : "Unable to update the account.", toastScope);
        } finally {
            button.disabled = false;
        }
    });

    void getAccountState().then(render).catch((error: unknown) => {
        button.disabled = true;
        description.textContent = error instanceof Error
            ? error.message
            : "Unable to connect to the extension background service.";
    });

    copy.append(title, description);
    row.append(copy, button);
    section.append(
        createHeading(sectionHeading, "edf-settings-section-title", "Account"),
        row,
    );
    return section;
}

export function createSettingsContent(settings: Settings, options: SettingsViewOptions): DocumentFragment {
    const content = document.createDocumentFragment();
    const toastScope = options.toastScope ?? "page";
    if (options.includeIntroduction !== false) {
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
    }

    content.append(createAccountSection(options.sectionHeading, toastScope));

    for (const section of SETTINGS_SECTIONS) {
        const card = document.createElement("section");
        const description = section.description ? document.createElement("p") : undefined;
        card.className = "edf-settings-section";
        if (description) {
            description.className = "edf-settings-section-description";
            description.textContent = section.description ?? "";
        }
        card.append(
            createHeading(options.sectionHeading, "edf-settings-section-title", section.title),
            ...(description ? [description] : []),
            ...section.settings.map(definition => createRow(definition, settings)),
        );
        content.append(card);
    }

    const maintenance = document.createElement("section");
    maintenance.className = "edf-settings-section";
    maintenance.append(
        createHeading(options.sectionHeading, "edf-settings-section-title", "Maintenance"),
        ...MAINTENANCE_ACTIONS.map(action => createActionRow(action, toastScope)),
    );
    content.append(maintenance);

    const support = document.createElement("section");
    const project = document.createElement("div");
    const name = document.createElement("p");
    const version = document.createElement("span");
    const publisher = document.createElement("p");
    support.className = "edf-settings-section";
    support.dataset.section = "support";
    project.className = "edf-settings-support-project";
    name.className = "edf-settings-support-meta";
    version.className = "edf-settings-support-version";
    publisher.className = "edf-settings-support-meta";
    name.textContent = "Extra Domain Filters";
    version.textContent = `Version ${chrome.runtime.getManifest().version}`;
    publisher.textContent = "Developed and published by Niclas Rogulski.";
    project.append(name, version);
    support.append(
        createHeading(options.sectionHeading, "edf-settings-section-title", "Support"),
        project,
        createSupportGroup(SUPPORT_GROUPS[0]),
        publisher,
        createSupportGroup(SUPPORT_GROUPS[1]),
    );
    content.append(support);

    return content;
}
