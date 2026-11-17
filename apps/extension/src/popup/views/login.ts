import wordmarkUrl from "../../../../../packages/assets/icons/brand/wordmark.svg?url";
import {
    createEmailAccount,
    loginWithEmail,
    loginWithProvider,
    requestPasswordReset,
} from "../../domain/account/client";
import type { AccountProvider, AccountState } from "../../domain/account/model";
import { createSvgIcon } from "../../ui/elements";
import {
    PROVIDER_ICONS,
    replaceWithCheckIcon,
    replaceWithChevronIcon,
    replaceWithEyeIcon,
    replaceWithEyeOffIcon,
} from "../../ui/icons";
import { showPopupToast } from "../toast";

interface LoginViewOptions {
    account?: AccountState;
    onBack(): void;
    onComplete(): void;
}

type LoginMode = "login" | "reset" | "sign-up";

const PROVIDERS: ReadonlyArray<readonly [AccountProvider, string]> = [
    ["google", "Google"],
    ["apple", "Apple"],
    ["facebook", "Facebook"],
];

/** New passwords need all of these; the list under the field ticks them off as you type. */
const PASSWORD_RULES: ReadonlyArray<{ label: string; test(value: string): boolean }> = [
    { label: "At least 8 characters", test: value => value.length >= 8 },
    { label: "A number", test: value => /\d/.test(value) },
    { label: "A special character, like ! or #", test: value => /[^A-Za-z0-9\s]/.test(value) },
];

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

const COPY: Record<LoginMode, {
    introduction: string;
    submit: string;
    switchAction: string;
    switchPrompt: string;
    title: string;
}> = {
    login: {
        introduction: "Sync your searches, blacklist and filters across your browsers.",
        submit: "Log in",
        switchAction: "Create an account",
        switchPrompt: "New here?",
        title: "Welcome back",
    },
    "sign-up": {
        introduction: "One account keeps your searches, blacklist and filters in sync.",
        submit: "Create account",
        switchAction: "Log in",
        switchPrompt: "Already have an account?",
        title: "Create your account",
    },
    reset: {
        introduction: "Enter your account's email and we'll send you a link to choose a new password.",
        submit: "Send reset link",
        switchAction: "Back to log in",
        switchPrompt: "Remembered it?",
        title: "Reset your password",
    },
};

const reducedMotion = (): boolean => window.matchMedia("(prefers-reduced-motion: reduce)").matches;
const EASE = "cubic-bezier(0.2, 0, 0, 1)";

function enter(element: HTMLElement, offset = 6): void {
    if (reducedMotion()) return;
    element.animate(
        [{ opacity: 0, transform: `translateY(${offset}px)` }, { opacity: 1, transform: "none" }],
        { duration: 220, easing: EASE },
    );
}

interface Field {
    element: HTMLElement;
    input: HTMLInputElement;
    label: HTMLLabelElement;
    /** Shows (or clears) the field's message; returns whether it is valid. */
    setError(message?: string): boolean;
}

let fieldCount = 0;

/** Label (with a red asterisk when required), input, and an inline error under it. */
function createField(options: {
    autocomplete: AutoFill;
    label: string;
    placeholder: string;
    required?: boolean;
    type?: string;
}): Field {
    const id = `edf-login-${++fieldCount}`;
    const element = document.createElement("div");
    const label = document.createElement("label");
    const control = document.createElement("div");
    const input = document.createElement("input");
    const error = document.createElement("p");

    element.className = "edf-login-field";
    label.className = "edf-login-label";
    label.htmlFor = id;
    label.append(options.label);
    if (options.required) {
        const asterisk = document.createElement("span");
        asterisk.className = "edf-login-required";
        asterisk.ariaHidden = "true";
        asterisk.textContent = "*";
        label.append(asterisk);
        input.required = true;
    }
    control.className = "edf-login-control";
    input.className = "edf-login-input";
    input.id = id;
    input.type = options.type ?? "text";
    input.autocomplete = options.autocomplete;
    input.placeholder = options.placeholder;
    input.setAttribute("aria-describedby", `${id}-error`);
    error.className = "edf-login-error";
    error.id = `${id}-error`;
    error.hidden = true;
    control.append(input);
    element.append(label, control, error);

    return {
        element,
        input,
        label,
        setError(message) {
            const invalid = Boolean(message);
            const changed = error.textContent !== (message ?? "");
            input.setAttribute("aria-invalid", String(invalid));
            element.dataset.invalid = String(invalid);
            error.textContent = message ?? "";
            error.hidden = !invalid;
            if (invalid && changed) enter(error, -4);
            return !invalid;
        },
    };
}

/** Eye icons that swap, with the input type, to show or hide what's typed. */
function addVisibilityToggle(field: Field): void {
    const toggle = document.createElement("button");
    toggle.type = "button";
    toggle.className = "edf-login-visibility";
    toggle.dataset.visible = "false";
    toggle.ariaLabel = "Show password";
    toggle.append(
        createSvgIcon(replaceWithEyeIcon, "edf-login-visibility-show"),
        createSvgIcon(replaceWithEyeOffIcon, "edf-login-visibility-hide"),
    );
    toggle.addEventListener("click", () => {
        const visible = field.input.type === "password";
        field.input.type = visible ? "text" : "password";
        toggle.dataset.visible = String(visible);
        toggle.ariaLabel = visible ? "Hide password" : "Show password";
        field.input.focus({ preventScroll: true });
    });
    field.input.parentElement?.append(toggle);
}

function createSpinner(): HTMLSpanElement {
    const spinner = document.createElement("span");
    spinner.className = "edf-login-spinner";
    spinner.ariaHidden = "true";
    return spinner;
}

/**
 * Sign-in: one-click providers, then email. Fields are checked inline (on leaving them, and
 * live once one shows an error), new passwords list their requirements as they're met, and
 * "Forgot password?" swaps in a reset form that ends on a check-your-inbox screen. A provider
 * window may close the popup; the background worker keeps the account, so it shows when the
 * popup reopens.
 */
export function createLoginView(options: LoginViewOptions): HTMLElement {
    let mode: LoginMode = "login";
    let busy = false;
    let submitted = false;
    const unavailable = options.account?.status === "unavailable";
    const view = document.createElement("section");
    const panel = document.createElement("div");
    const header = document.createElement("header");
    const back = document.createElement("button");
    const brand = document.createElement("img");
    const content = document.createElement("div");
    const title = document.createElement("h1");
    const introduction = document.createElement("p");
    const providers = document.createElement("div");
    const divider = document.createElement("div");
    const form = document.createElement("form");
    const banner = document.createElement("p");
    const name = createField({ autocomplete: "name", label: "Name", placeholder: "Your name" });
    const email = createField({
        autocomplete: "email",
        label: "Email",
        placeholder: "you@example.com",
        required: true,
        type: "email",
    });
    const password = createField({
        autocomplete: "current-password",
        label: "Password",
        placeholder: "Your password",
        required: true,
        type: "password",
    });
    const confirmation = createField({
        autocomplete: "new-password",
        label: "Confirm password",
        placeholder: "Repeat your password",
        required: true,
        type: "password",
    });
    const forgot = document.createElement("button");
    const rules = document.createElement("ul");
    const submit = document.createElement("button");
    const submitLabel = document.createElement("span");
    const switcher = document.createElement("p");
    const switchPrompt = document.createElement("span");
    const switchAction = document.createElement("button");
    const done = document.createElement("div");
    const image = document.createElement("aside");
    const providerButtons: HTMLButtonElement[] = [];

    view.className = "edf-popup-login";
    panel.className = "edf-login-panel";
    header.className = "edf-login-header";
    back.className = "edf-login-back";
    back.type = "button";
    back.ariaLabel = "Back";
    back.append(createSvgIcon(replaceWithChevronIcon));
    back.addEventListener("click", options.onBack);
    brand.className = "edf-login-brand";
    brand.alt = "Extra Domain Filters";
    brand.src = wordmarkUrl;
    content.className = "edf-login-content";
    introduction.className = "edf-login-introduction";
    providers.className = "edf-login-providers";
    divider.className = "edf-login-divider";
    divider.textContent = "or with email";
    form.className = "edf-login-form";
    form.noValidate = true;
    banner.className = "edf-login-banner";
    banner.role = "alert";
    banner.hidden = true;
    addVisibilityToggle(password);
    addVisibilityToggle(confirmation);
    forgot.className = "edf-login-forgot";
    forgot.type = "button";
    forgot.textContent = "Forgot password?";
    forgot.addEventListener("click", () => setMode("reset"));
    password.label.after(forgot);
    password.element.classList.add("edf-login-field-password");
    rules.className = "edf-login-rules";
    rules.ariaLabel = "Password requirements";
    rules.append(...PASSWORD_RULES.map(rule => {
        const item = document.createElement("li");
        item.dataset.met = "false";
        item.append(createSvgIcon(replaceWithCheckIcon, "edf-login-rule-icon"), rule.label);
        return item;
    }));
    password.element.append(rules);
    submit.className = "edf-login-submit";
    submit.type = "submit";
    submit.append(createSpinner(), submitLabel);
    switcher.className = "edf-login-switch";
    switchAction.type = "button";
    switchAction.addEventListener("click", () => setMode(mode === "login" ? "sign-up" : "login"));
    switcher.append(switchPrompt, " ", switchAction);
    done.className = "edf-login-done";
    done.hidden = true;

    const setBanner = (message = "", tone: "error" | "info" = "error"): void => {
        banner.textContent = message;
        banner.dataset.tone = tone;
        banner.hidden = !message;
        if (message) enter(banner, -4);
    };
    // `trigger` shows the spinner; everything else waits until the attempt settles.
    const setBusy = (trigger?: HTMLButtonElement): void => {
        busy = Boolean(trigger);
        for (const button of [submit, forgot, switchAction, ...providerButtons]) {
            button.disabled = busy || unavailable;
            button.dataset.busy = String(button === trigger);
        }
        for (const field of [name, email, password, confirmation]) field.input.readOnly = busy;
        view.ariaBusy = String(busy);
    };
    const visibleFields = (): Field[] => mode === "reset"
        ? [email]
        : mode === "sign-up" ? [name, email, password, confirmation] : [email, password];

    const validators = new Map<Field, () => string | undefined>([
        [name, () => undefined],
        [email, () => {
            const value = email.input.value.trim();
            if (!value) return "Enter your email.";
            return EMAIL_PATTERN.test(value) ? undefined : "Enter a valid email, like name@example.com.";
        }],
        [password, () => {
            const value = password.input.value;
            if (!value) return mode === "sign-up" ? "Choose a password." : "Enter your password.";
            if (mode !== "sign-up") return undefined;
            return PASSWORD_RULES.every(rule => rule.test(value))
                ? undefined
                : "Your password needs every requirement below.";
        }],
        [confirmation, () => {
            if (!confirmation.input.value) return "Repeat your password.";
            return confirmation.input.value === password.input.value ? undefined : "The passwords don't match.";
        }],
    ]);
    const validate = (field: Field): boolean => field.setError(validators.get(field)?.());
    const renderRules = (): void => {
        const value = password.input.value;
        rules.querySelectorAll("li").forEach((item, index) => {
            const met = String(PASSWORD_RULES[index].test(value));
            if (item.dataset.met !== met) item.dataset.met = met;
        });
    };

    for (const field of [name, email, password, confirmation]) {
        // Checked on leaving a field (once something is typed or a submit was tried), then live
        // while it shows an error, so the message clears the moment it's fixed.
        field.input.addEventListener("blur", () => {
            // A new password's checklist already says what's missing; its message waits for submit.
            if (field === password && mode === "sign-up" && !submitted) return;
            if (field.input.value || submitted) validate(field);
        });
        field.input.addEventListener("input", () => {
            if (field.element.dataset.invalid === "true") validate(field);
            if (field === password) {
                renderRules();
                if (confirmation.element.dataset.invalid === "true") validate(confirmation);
            }
            if (!banner.hidden && banner.dataset.tone === "error") setBanner();
        });
    }

    const setMode = (next: LoginMode): void => {
        const changed = next !== mode;
        mode = next;
        submitted = false;
        const copy = COPY[mode];
        const signingUp = mode === "sign-up";
        name.element.hidden = !signingUp;
        password.element.hidden = mode === "reset";
        confirmation.element.hidden = !signingUp;
        forgot.hidden = mode !== "login";
        rules.hidden = !signingUp;
        password.input.autocomplete = signingUp ? "new-password" : "current-password";
        password.input.placeholder = signingUp ? "Create a password" : "Your password";
        providers.hidden = mode === "reset" || providerButtons.length === 0;
        divider.hidden = providers.hidden;
        form.hidden = false;
        done.hidden = true;
        switcher.hidden = false;
        title.textContent = copy.title;
        introduction.textContent = copy.introduction;
        submitLabel.textContent = copy.submit;
        switchPrompt.textContent = copy.switchPrompt;
        switchAction.textContent = copy.switchAction;
        for (const field of [name, email, password, confirmation]) field.setError();
        renderRules();
        setBanner(unavailable ? "Sync isn't set up in this build of the extension." : "");
        if (changed) enter(content);
    };

    /** After a reset request: a check-your-inbox screen with the way back. */
    const showResetSent = (address: string): void => {
        const icon = createSvgIcon(replaceWithCheckIcon, "edf-login-done-icon");
        const heading = document.createElement("p");
        const text = document.createElement("p");
        const again = document.createElement("button");
        heading.className = "edf-login-done-title";
        heading.textContent = "Check your inbox";
        text.className = "edf-login-done-text";
        text.textContent = `If there's an account for ${address}, a link to reset its password is on its way. It can take a minute to arrive.`;
        again.type = "button";
        again.className = "edf-login-submit";
        again.textContent = "Back to log in";
        again.addEventListener("click", () => setMode("login"));
        done.replaceChildren(icon, heading, text, again);
        form.hidden = true;
        providers.hidden = true;
        divider.hidden = true;
        switcher.hidden = true;
        title.textContent = "Reset link sent";
        introduction.textContent = "";
        done.hidden = false;
        enter(content);
    };

    form.addEventListener("submit", async event => {
        event.preventDefault();
        if (busy) return;
        submitted = true;
        const invalid = visibleFields().filter(field => !validate(field));
        if (invalid.length > 0) {
            invalid[0].input.focus();
            if (!reducedMotion()) {
                form.animate(
                    [{ transform: "translateX(0)" }, { transform: "translateX(-5px)" }, { transform: "translateX(5px)" }, { transform: "translateX(0)" }],
                    { duration: 240, easing: "ease-in-out" },
                );
            }
            return;
        }
        setBusy(submit);
        setBanner();
        const address = email.input.value.trim();
        try {
            if (mode === "reset") {
                await requestPasswordReset(address);
                showResetSent(address);
            } else if (mode === "sign-up") {
                await createEmailAccount(address, password.input.value, name.input.value.trim() || undefined);
                showPopupToast("Account created. Check your email to verify it.");
                options.onComplete();
            } else {
                await loginWithEmail(address, password.input.value);
                showPopupToast("Logged in");
                options.onComplete();
            }
        } catch (error) {
            setBanner(error instanceof Error ? error.message : "That didn't work. Try again.");
        } finally {
            setBusy();
        }
    });

    // Providers show whenever sync is configured, even if the account state was slow to load.
    for (const [provider, label] of PROVIDERS) {
        if (options.account && !options.account.capabilities[provider]) continue;
        const button = document.createElement("button");
        const mark = document.createElement("span");
        button.className = "edf-login-provider";
        button.type = "button";
        button.ariaLabel = `Continue with ${label}`;
        mark.className = "edf-login-provider-mark";
        mark.append(createSvgIcon(PROVIDER_ICONS[provider]), createSpinner());
        button.append(mark, label);
        button.addEventListener("click", async () => {
            if (busy) return;
            setBusy(button);
            setBanner(`Finish signing in with ${label} in the window that opened.`, "info");
            try {
                await loginWithProvider(provider);
                showPopupToast(`Logged in with ${label}`);
                options.onComplete();
            } catch (error) {
                setBanner(error instanceof Error ? error.message : `${label} sign-in didn't finish.`);
            } finally {
                setBusy();
            }
        });
        providerButtons.push(button);
        providers.append(button);
    }

    image.className = "edf-popup-login-image";
    image.setAttribute("aria-label", "Contemporary Australian home interior");
    form.append(banner, name.element, email.element, password.element, confirmation.element, submit);
    header.append(back, brand);
    content.append(title, introduction, providers, divider, form, done, switcher);
    panel.append(header, content);
    view.append(panel, image);
    setMode("login");
    setBusy();
    return view;
}
