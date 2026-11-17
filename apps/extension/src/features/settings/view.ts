import { browser } from "wxt/browser";
import { CHROME_WEB_STORE_URL, GITHUB_URL } from "@extra-domain-filters/shared/config/links";
import { getAccountState, loginWithProvider, signOut } from "../../domain/account/client";
import type { AccountProvider, AccountState } from "../../domain/account/model";
import { setBlacklist } from "../../domain/blacklist/store";
import { clearListingCache } from "../../domain/listings/cache";
import { trackTelemetry } from "../../domain/telemetry/client";
import { updateSettings, type Settings } from "../../state/settings";
import { createSvgIcon } from "../../ui/elements";
import {
    replaceWithChromeWebStoreIcon,
    replaceWithExternalIcon,
    replaceWithGithubIcon,
    replaceWithItchioIcon,
    replaceWithLinkedInIcon,
    PROVIDER_ICONS,
} from "../../ui/icons";
import { createDropdownControl } from "../../ui/sort";
import { showToast, type ToastScope } from "../../ui/toast";
import type { ChoiceSettingDefinition, SettingDefinition, SettingsControlDefinition } from "./definitions";
import { SETTINGS_SECTIONS } from "./definitions";

type HeadingTag = "h1" | "h2" | "h3";

interface SettingsViewOptions {
    /** Sections shown elsewhere (the popup's Filters page shows "filters"). */
    excludeSections?: readonly string[];
    includeIntroduction?: boolean;
    /** Where an email sign-in form exists (the popup), the Account card links to it. */
    onEmailSignIn?(): void;
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
        description: "Forget the listing details and photos read so far. They're read again when needed.",
        label: "Clear cache",
        run: clearListingCache,
    },
    {
        title: "Clear blacklist",
        description: "Show every blacklisted listing, agency and agent again.",
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
                href: GITHUB_URL,
                icon: "github",
            },
            {
                title: "Chrome Web Store",
                href: CHROME_WEB_STORE_URL,
                icon: "chrome-web-store",
            },
            {
                title: "Feedback and issues",
                href: `${GITHUB_URL}/issues/new/choose`,
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

export function createSettingRow(definition: SettingsControlDefinition, settings: Settings): HTMLElement {
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

const PROVIDERS: ReadonlyArray<readonly [AccountProvider, string]> = [
    ["google", "Google"],
    ["apple", "Apple"],
    ["facebook", "Facebook"],
];

function createAvatar(state: AccountState): HTMLElement {
    const avatar = document.createElement("span");
    avatar.className = "edf-settings-account-avatar";
    avatar.ariaHidden = "true";
    if (state.profile?.photoUrl) {
        const image = document.createElement("img");
        image.alt = "";
        image.src = state.profile.photoUrl;
        avatar.append(image);
    } else {
        avatar.textContent = (state.profile?.displayName ?? state.profile?.email ?? "E").charAt(0).toUpperCase();
    }
    return avatar;
}

/**
 * Account: who is signed in and Log out, or Google, Apple and Facebook buttons (and email,
 * where a sign-in form exists, i.e. the popup). Cross-device sync sits underneath.
 */
function createAccountSection(
    settings: Settings,
    options: Pick<SettingsViewOptions, "onEmailSignIn" | "sectionHeading" | "toastScope">,
): HTMLElement {
    const toastScope = options.toastScope ?? "page";
    const section = document.createElement("section");
    const body = document.createElement("div");
    section.className = "edf-settings-section";
    section.dataset.section = "account";
    body.className = "edf-settings-account";

    const setDisabled = (disabled: boolean): void => {
        body.querySelectorAll("button").forEach(button => { button.disabled = disabled; });
    };
    const run = async (button: HTMLButtonElement, action: () => Promise<AccountState>, done: string): Promise<void> => {
        setDisabled(true);
        button.dataset.busy = "true";
        try {
            render(await action());
            showToast(done, toastScope);
        } catch (error) {
            showToast(error instanceof Error ? error.message : "Couldn't update your account.", toastScope);
            setDisabled(false);
            delete button.dataset.busy;
        }
    };
    const render = (state: AccountState): void => {
        body.ariaBusy = "false";
        if (state.status === "unavailable") {
            const copy = document.createElement("div");
            const title = document.createElement("p");
            const description = document.createElement("p");
            copy.className = "edf-settings-copy";
            title.className = "edf-settings-row-title";
            title.textContent = "Sync isn't available";
            description.className = "edf-settings-row-description";
            description.textContent = "This build of the extension has no sync service. Everything still works on this browser.";
            copy.append(title, description);
            body.dataset.state = "unavailable";
            body.replaceChildren(copy);
            return;
        }
        if (state.status === "signed-in") {
            const identity = document.createElement("div");
            const name = document.createElement("p");
            const email = document.createElement("p");
            const logout = document.createElement("button");
            identity.className = "edf-settings-copy";
            name.className = "edf-settings-row-title";
            name.textContent = state.profile?.displayName ?? state.profile?.email ?? "Signed in";
            email.className = "edf-settings-row-description";
            email.textContent = state.profile?.displayName ? state.profile.email ?? "" : "Syncing across your browsers";
            identity.append(name, email);
            logout.type = "button";
            logout.className = "edf-settings-action edf-domain-button";
            logout.textContent = "Log out";
            logout.addEventListener("click", () => void run(logout, signOut, "Logged out"));
            body.dataset.state = "signed-in";
            body.replaceChildren(createAvatar(state), identity, logout);
            return;
        }

        const copy = document.createElement("div");
        const title = document.createElement("p");
        const description = document.createElement("p");
        const providers = document.createElement("div");
        copy.className = "edf-settings-copy";
        title.className = "edf-settings-row-title";
        title.textContent = "Sign in to sync";
        description.className = "edf-settings-row-description";
        description.textContent = "Keep your filters, blacklist and searches on every browser you use.";
        copy.append(title, description);
        providers.className = "edf-settings-providers";
        for (const [provider, label] of PROVIDERS) {
            if (!state.capabilities[provider]) continue;
            const button = document.createElement("button");
            button.type = "button";
            button.className = "edf-settings-provider";
            button.ariaLabel = `Continue with ${label}`;
            button.append(createSvgIcon(PROVIDER_ICONS[provider], "edf-settings-provider-icon"), label);
            button.addEventListener("click", () =>
                void run(button, () => loginWithProvider(provider), `Signed in with ${label}`));
            providers.append(button);
        }
        if (options.onEmailSignIn && state.capabilities.emailPassword) {
            const email = document.createElement("button");
            email.type = "button";
            email.className = "edf-settings-provider";
            email.textContent = "Email";
            email.addEventListener("click", () => options.onEmailSignIn?.());
            providers.append(email);
        }
        body.dataset.state = "signed-out";
        body.replaceChildren(copy, providers);
    };

    /** Placeholder shapes of the signed-in row while the background worker answers. */
    const renderLoading = (): void => {
        const lines = document.createElement("span");
        lines.className = "edf-settings-skeleton-lines";
        lines.append(...["38%", "64%"].map(width => {
            const line = document.createElement("span");
            line.className = "edf-settings-skeleton";
            line.style.width = width;
            return line;
        }));
        const avatar = document.createElement("span");
        avatar.className = "edf-settings-skeleton edf-settings-skeleton-avatar";
        body.ariaBusy = "true";
        body.ariaLabel = "Checking your account";
        body.dataset.state = "loading";
        body.replaceChildren(avatar, lines);
    };
    /** The worker didn't answer (it may be restarting): say so, with a way to ask again. */
    const renderError = (message: string): void => {
        const copy = document.createElement("div");
        const title = document.createElement("p");
        const description = document.createElement("p");
        const retry = document.createElement("button");
        copy.className = "edf-settings-copy";
        title.className = "edf-settings-row-title";
        title.textContent = "Couldn't check your account";
        description.className = "edf-settings-row-description";
        description.textContent = message;
        copy.append(title, description);
        retry.type = "button";
        retry.className = "edf-settings-action edf-domain-button";
        retry.textContent = "Try again";
        retry.addEventListener("click", load);
        body.ariaBusy = "false";
        body.dataset.state = "error";
        body.replaceChildren(copy, retry);
    };
    function load(): void {
        renderLoading();
        const timeout = new Promise<never>((_, reject) => window.setTimeout(
            () => reject(new Error("The extension didn't answer in time. It may still be starting up.")),
            8000,
        ));
        void Promise.race([getAccountState(), timeout]).then(state => {
            body.removeAttribute("aria-label");
            render(state);
        }).catch((error: unknown) => {
            renderError(error instanceof Error ? error.message : "The extension's background service didn't answer.");
        });
    }
    load();

    const sync = SETTINGS_SECTIONS.find(candidate => candidate.id === "sync");
    section.append(
        createHeading(options.sectionHeading, "edf-settings-section-title", "Account"),
        body,
        ...(sync?.settings.map(definition => createSettingRow(definition, settings)) ?? []),
    );
    return section;
}

/** One settings card (toggles and choices) by section id. */
export function createSettingsSection(id: string, settings: Settings, heading: HeadingTag): HTMLElement | undefined {
    const section = SETTINGS_SECTIONS.find(candidate => candidate.id === id);
    if (!section) return undefined;
    const card = document.createElement("section");
    card.className = "edf-settings-section";
    card.dataset.section = id;
    card.append(createHeading(heading, "edf-settings-section-title", section.title));
    if (section.description) {
        const description = document.createElement("p");
        description.className = "edf-settings-section-description";
        description.textContent = section.description;
        card.append(description);
    }
    card.append(...section.settings.map(definition => createSettingRow(definition, settings)));
    return card;
}

function createSupportSection(heading: HeadingTag): HTMLElement {
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
    version.textContent = `Version ${browser.runtime.getManifest().version}`;
    publisher.textContent = "Developed and published by Niclas Rogulski.";
    project.append(name, version);
    support.append(
        createHeading(heading, "edf-settings-section-title", "Support"),
        project,
        createSupportGroup(SUPPORT_GROUPS[0]),
        publisher,
        createSupportGroup(SUPPORT_GROUPS[1]),
    );
    return support;
}

/**
 * Account, General, the filter-panel options (unless shown elsewhere), Privacy and data (with
 * the maintenance actions) and Support. Each card carries data-section, so a page can insert
 * its own cards in between (Domain's settings page adds the Filters cards after General).
 */
export function createSettingsContent(settings: Settings, options: SettingsViewOptions): DocumentFragment {
    const content = document.createDocumentFragment();
    const toastScope = options.toastScope ?? "page";
    const heading = options.sectionHeading;
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

    content.append(createAccountSection(settings, options));
    for (const id of ["general", "filters"]) {
        if (!options.excludeSections?.includes(id)) content.append(createSettingsSection(id, settings, heading)!);
    }
    const privacy = createSettingsSection("privacy", settings, heading)!;
    privacy.append(...MAINTENANCE_ACTIONS.map(action => createActionRow(action, toastScope)));
    content.append(privacy, createSupportSection(heading));
    return content;
}
