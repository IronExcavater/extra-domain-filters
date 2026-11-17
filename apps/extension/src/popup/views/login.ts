import wordmarkUrl from "../../../../../packages/assets/icons/brand/wordmark.svg?url";
import {
    createEmailAccount,
    loginWithProvider,
    loginWithEmail,
    requestPasswordReset,
} from "../../domain/account/client";
import type { AccountProvider, AccountState } from "../../domain/account/model";
import { createSvgIcon } from "../../ui/elements";
import { replaceWithChevronIcon } from "../../ui/icons";
import { showPopupToast } from "../toast";

interface LoginViewOptions {
    account?: AccountState;
    onBack(): void;
    onComplete(): void;
}

type LoginMode = "login" | "sign-up";

const PROVIDER_LABELS: Record<AccountProvider, string> = {
    apple: "Apple",
    facebook: "Facebook",
    google: "Google",
};

const COPY: Record<LoginMode, { introduction: string; submit: string; switchAction: string; switchPrompt: string; title: string }> = {
    login: {
        introduction: "Sync your searches, blacklist and preferences across your browsers.",
        submit: "Log in",
        switchAction: "Create an account",
        switchPrompt: "New here?",
        title: "Welcome back",
    },
    "sign-up": {
        introduction: "One account keeps your searches, blacklist and preferences in sync.",
        submit: "Create account",
        switchAction: "Log in",
        switchPrompt: "Already have an account?",
        title: "Create your account",
    },
};

function createProviderMark(provider: AccountProvider): SVGSVGElement {
    const icon = document.createElementNS("http://www.w3.org/2000/svg", "svg");
    icon.setAttribute("aria-hidden", "true");
    icon.setAttribute("viewBox", "0 0 24 24");
    if (provider === "google") {
        icon.innerHTML = "<path fill=\"#4285f4\" d=\"M21.35 12.23c0-.71-.06-1.39-.18-2.05H12v3.88h5.24a4.48 4.48 0 0 1-1.94 2.94v2.52h3.15c1.84-1.7 2.9-4.2 2.9-7.29Z\"/><path fill=\"#34a853\" d=\"M12 21.75c2.63 0 4.84-.87 6.45-2.23l-3.15-2.52c-.87.59-1.99.94-3.3.94-2.54 0-4.7-1.72-5.47-4.03H3.27v2.6A9.75 9.75 0 0 0 12 21.75Z\"/><path fill=\"#fbbc05\" d=\"M6.53 13.91A5.87 5.87 0 0 1 6.22 12c0-.66.11-1.3.31-1.91v-2.6H3.27A9.75 9.75 0 0 0 3.27 16.5l3.26-2.59Z\"/><path fill=\"#ea4335\" d=\"M12 6.06c1.43 0 2.72.49 3.73 1.45l2.8-2.8C16.84 3.14 14.63 2.25 12 2.25a9.75 9.75 0 0 0-8.73 5.24l3.26 2.6C7.3 7.78 9.46 6.06 12 6.06Z\"/>";
    } else if (provider === "apple") {
        icon.innerHTML = "<path fill=\"currentColor\" d=\"M16.7 12.7c0-2.4 2-3.6 2.1-3.7-1.1-1.7-2.9-1.9-3.6-1.9-1.5-.2-3 .9-3.8.9-.8 0-1.9-.9-3.2-.9-1.6 0-3.2 1-4 2.5-1.7 3-.4 7.5 1.2 9.9.8 1.2 1.8 2.5 3.1 2.4 1.2 0 1.7-.8 3.2-.8s1.9.8 3.2.8 2.2-1.2 3-2.4c.9-1.4 1.3-2.8 1.3-2.9-.1 0-2.5-1-2.5-3.9ZM14.2 5.5c.7-.9 1.2-2.2 1.1-3.5-1.1 0-2.4.8-3.2 1.7-.7.8-1.3 2.1-1.2 3.4 1.2.1 2.5-.7 3.3-1.6Z\"/>";
    } else {
        icon.innerHTML = "<path fill=\"#1877f2\" d=\"M22 12a10 10 0 1 0-11.6 9.9v-7H7.9V12h2.5V9.8c0-2.5 1.5-3.9 3.8-3.9 1.1 0 2.3.2 2.3.2v2.5h-1.3c-1.3 0-1.7.8-1.7 1.6V12h2.8l-.4 2.9h-2.4v7A10 10 0 0 0 22 12Z\"/>";
    }
    return icon;
}

function createField(labelText: string, input: HTMLInputElement): HTMLLabelElement {
    const label = document.createElement("label");
    const text = document.createElement("span");
    label.className = "edf-popup-login-field";
    input.className = "edf-popup-login-input";
    text.textContent = labelText;
    label.append(text, input);
    return label;
}

function addPasswordToggle(field: HTMLLabelElement, input: HTMLInputElement): HTMLButtonElement {
    const control = document.createElement("span");
    const toggle = document.createElement("button");
    control.className = "edf-popup-login-password-control";
    toggle.className = "edf-popup-login-password-toggle";
    toggle.type = "button";
    toggle.textContent = "Show";
    toggle.ariaLabel = "Show password";
    toggle.addEventListener("click", () => {
        const visible = input.type === "text";
        input.type = visible ? "password" : "text";
        toggle.textContent = visible ? "Show" : "Hide";
        toggle.ariaLabel = visible ? "Show password" : "Hide password";
    });
    input.replaceWith(control);
    control.append(input, toggle);
    field.append(control);
    return toggle;
}

function createSpinner(): HTMLSpanElement {
    const spinner = document.createElement("span");
    spinner.className = "edf-popup-login-spinner";
    spinner.ariaHidden = "true";
    return spinner;
}

/**
 * Sign-in: one-click providers first, email below, and a link at the bottom to switch between
 * logging in and creating an account. The button that started a sign-in shows a spinner until
 * it settles; the provider window can close the popup, which is fine, as the account is kept
 * by the background worker and shows when the popup reopens.
 */
export function createLoginView(options: LoginViewOptions): HTMLElement {
    let mode: LoginMode = "login";
    let busy = false;
    const unavailable = options.account?.status === "unavailable";
    const view = document.createElement("section");
    const panel = document.createElement("div");
    const header = document.createElement("header");
    const content = document.createElement("div");
    const brand = document.createElement("img");
    const back = document.createElement("button");
    const title = document.createElement("h1");
    const introduction = document.createElement("p");
    const providers = document.createElement("div");
    const divider = document.createElement("div");
    const form = document.createElement("form");
    const name = document.createElement("input");
    const email = document.createElement("input");
    const password = document.createElement("input");
    const confirmation = document.createElement("input");
    const nameField = createField("Name (optional)", name);
    const emailField = createField("Email", email);
    const passwordField = createField("Password", password);
    const confirmationField = createField("Confirm password", confirmation);
    const forgot = document.createElement("button");
    const submit = document.createElement("button");
    const submitLabel = document.createElement("span");
    const status = document.createElement("p");
    const switcher = document.createElement("p");
    const switchPrompt = document.createElement("span");
    const switchAction = document.createElement("button");
    const image = document.createElement("aside");
    const passwordToggle = addPasswordToggle(passwordField, password);
    const confirmationToggle = addPasswordToggle(confirmationField, confirmation);
    const providerButtons: HTMLButtonElement[] = [];
    const interactive = [forgot, submit, passwordToggle, confirmationToggle, switchAction];

    view.className = "edf-popup-login";
    panel.className = "edf-popup-login-panel";
    header.className = "edf-popup-login-header";
    content.className = "edf-popup-login-content";
    brand.className = "edf-popup-login-brand";
    brand.alt = "Extra Domain Filters";
    brand.src = wordmarkUrl;
    back.className = "edf-popup-login-back";
    back.type = "button";
    back.append(createSvgIcon(replaceWithChevronIcon), document.createTextNode("Back"));
    back.addEventListener("click", options.onBack);
    introduction.className = "edf-popup-login-introduction";
    providers.className = "edf-popup-login-providers";
    divider.className = "edf-popup-login-divider";
    divider.textContent = "or use email";
    form.className = "edf-popup-login-form";
    name.autocomplete = "name";
    name.maxLength = 100;
    name.placeholder = "Your name";
    email.autocomplete = "email";
    email.placeholder = "you@example.com";
    email.required = true;
    email.type = "email";
    password.placeholder = "Your password";
    password.required = true;
    password.type = "password";
    confirmation.autocomplete = "new-password";
    confirmation.placeholder = "Repeat your password";
    confirmation.type = "password";
    forgot.className = "edf-popup-login-forgot";
    forgot.type = "button";
    forgot.textContent = "Forgot password?";
    submit.className = "edf-popup-login-submit";
    submit.type = "submit";
    submit.append(submitLabel);
    status.className = "edf-popup-login-status";
    status.role = "status";
    status.ariaLive = "polite";
    switcher.className = "edf-popup-login-switch";
    switchAction.type = "button";
    switchAction.addEventListener("click", () => setMode(mode === "login" ? "sign-up" : "login"));
    switcher.append(switchPrompt, " ", switchAction);

    const setStatus = (message = "", tone: "error" | "info" = "info"): void => {
        status.textContent = message;
        status.dataset.tone = tone;
    };
    // `trigger` shows the spinner; everything else is disabled until the attempt settles.
    const setBusy = (trigger?: HTMLButtonElement): void => {
        busy = Boolean(trigger);
        for (const button of [...interactive, ...providerButtons]) {
            button.disabled = busy || unavailable;
            button.dataset.busy = String(button === trigger);
        }
        for (const input of [name, email, password, confirmation]) input.readOnly = busy;
        view.ariaBusy = String(busy);
    };
    const complete = (message: string): void => {
        showPopupToast(message);
        options.onComplete();
    };
    const reveal = (element: HTMLElement): void => {
        if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
        element.animate(
            [{ opacity: 0, transform: "translateY(-4px)" }, { opacity: 1, transform: "none" }],
            { duration: 180, easing: "cubic-bezier(0.2, 0, 0, 1)" },
        );
    };
    const setMode = (next: LoginMode): void => {
        const changed = next !== mode;
        mode = next;
        const signingUp = mode === "sign-up";
        const copy = COPY[mode];
        nameField.hidden = !signingUp;
        confirmationField.hidden = !signingUp;
        forgot.hidden = signingUp;
        password.autocomplete = signingUp ? "new-password" : "current-password";
        password.minLength = signingUp ? 8 : 1;
        confirmation.required = signingUp;
        confirmation.minLength = signingUp ? 8 : 0;
        title.textContent = copy.title;
        introduction.textContent = copy.introduction;
        submitLabel.textContent = copy.submit;
        switchPrompt.textContent = copy.switchPrompt;
        switchAction.textContent = copy.switchAction;
        setStatus(unavailable ? "Sync isn't set up for this build of the extension." : "", "error");
        if (changed) {
            reveal(title);
            if (signingUp) [nameField, confirmationField].forEach(reveal);
        }
    };

    forgot.addEventListener("click", async () => {
        if (busy) return;
        if (!email.value.trim()) {
            setStatus("Enter your email first, then we'll send a reset link.", "error");
            email.focus();
            return;
        }
        if (!email.reportValidity()) return;
        setBusy(forgot);
        setStatus();
        try {
            await requestPasswordReset(email.value);
            setStatus("If an account exists for that email, a reset link is on its way.");
        } catch (error) {
            setStatus(error instanceof Error ? error.message : "Could not send the reset email.", "error");
        } finally {
            setBusy();
        }
    });
    confirmation.addEventListener("input", () => confirmation.setCustomValidity(""));
    form.addEventListener("submit", async event => {
        event.preventDefault();
        if (busy || !form.reportValidity()) return;
        if (mode === "sign-up" && password.value !== confirmation.value) {
            confirmation.setCustomValidity("Passwords do not match.");
            confirmation.reportValidity();
            return;
        }
        setBusy(submit);
        setStatus();
        try {
            if (mode === "sign-up") {
                await createEmailAccount(email.value, password.value, name.value);
                complete("Account created. Check your email to verify it.");
            } else {
                await loginWithEmail(email.value, password.value);
                complete("Logged in");
            }
        } catch (error) {
            setStatus(error instanceof Error ? error.message : "Login did not complete.", "error");
        } finally {
            setBusy();
        }
    });

    // Providers show whenever sync is configured, even if the account state was slow to load.
    for (const provider of ["google", "apple", "facebook"] as const) {
        if (options.account && !options.account.capabilities[provider]) continue;
        const label = PROVIDER_LABELS[provider];
        const button = document.createElement("button");
        const mark = document.createElement("span");
        button.className = "edf-popup-auth-provider";
        button.type = "button";
        button.ariaLabel = `Continue with ${label}`;
        mark.className = "edf-popup-auth-provider-mark";
        mark.append(createProviderMark(provider), createSpinner());
        button.append(mark, document.createTextNode(label));
        button.addEventListener("click", async () => {
            if (busy) return;
            setBusy(button);
            setStatus(`Finish signing in with ${label} in the window that opened.`);
            try {
                await loginWithProvider(provider);
                complete(`Logged in with ${label}`);
            } catch (error) {
                setStatus(error instanceof Error ? error.message : `${label} login did not complete.`, "error");
            } finally {
                setBusy();
            }
        });
        providerButtons.push(button);
        providers.append(button);
    }
    submit.prepend(createSpinner());

    image.className = "edf-popup-login-image";
    image.setAttribute("aria-label", "Contemporary Australian home interior");
    form.append(nameField, emailField, passwordField, confirmationField, forgot, submit, status);
    header.append(back, brand);
    content.append(title, introduction);
    if (providerButtons.length > 0) content.append(providers, divider);
    content.append(form, switcher);
    panel.append(header, content);
    view.append(panel, image);
    setMode("login");
    setBusy();
    return view;
}
