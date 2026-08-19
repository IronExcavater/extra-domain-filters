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
type SocialProvider = AccountProvider;

function createProviderMark(provider: SocialProvider): SVGSVGElement {
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

function createWordmark(): HTMLImageElement {
    const image = document.createElement("img");
    image.alt = "Extra Domain Filters";
    image.src = wordmarkUrl;
    return image;
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

export function createLoginView(options: LoginViewOptions): HTMLElement {
    let mode: LoginMode = "login";
    let busy = false;
    const view = document.createElement("section");
    const panel = document.createElement("div");
    const header = document.createElement("header");
    const content = document.createElement("div");
    const brand = createWordmark();
    const back = document.createElement("button");
    const title = document.createElement("h1");
    const introduction = document.createElement("p");
    const modes = document.createElement("div");
    const loginMode = document.createElement("button");
    const signUpMode = document.createElement("button");
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
    const status = document.createElement("p");
    const divider = document.createElement("div");
    const providers = document.createElement("div");
    const image = document.createElement("aside");
    const passwordToggle = addPasswordToggle(passwordField, password);
    const confirmationToggle = addPasswordToggle(confirmationField, confirmation);
    const interactive = [loginMode, signUpMode, forgot, submit, passwordToggle, confirmationToggle];

    view.className = "edf-popup-login";
    panel.className = "edf-popup-login-panel";
    header.className = "edf-popup-login-header";
    content.className = "edf-popup-login-content";
    brand.className = "edf-popup-login-brand";
    back.className = "edf-popup-login-back";
    back.type = "button";
    back.ariaLabel = "Back";
    back.append(createSvgIcon(replaceWithChevronIcon), document.createTextNode("Back"));
    back.addEventListener("click", options.onBack);
    title.textContent = "Log in";
    introduction.className = "edf-popup-login-introduction";
    introduction.textContent = "Log in to sync your searches, blacklist and preferences.";
    modes.className = "edf-popup-login-modes";
    for (const [button, label] of [[loginMode, "Log in"], [signUpMode, "Create account"]] as const) {
        button.type = "button";
        button.textContent = label;
        modes.append(button);
    }
    form.className = "edf-popup-login-form";
    name.autocomplete = "name";
    name.maxLength = 100;
    name.placeholder = "Your name";
    email.autocomplete = "email";
    email.placeholder = "you@example.com";
    email.required = true;
    email.type = "email";
    password.autocomplete = "current-password";
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
    submit.textContent = "Log in";
    status.className = "edf-popup-login-status";
    status.role = "alert";
    status.ariaLive = "polite";
    divider.className = "edf-popup-login-divider";
    divider.textContent = "or continue with";
    providers.className = "edf-popup-login-providers";

    const setStatus = (message = "", error = false): void => {
        status.textContent = message;
        status.dataset.error = String(error);
    };
    const providerButtons: HTMLButtonElement[] = [];
    const setBusy = (value: boolean): void => {
        busy = value;
        [...interactive, ...providerButtons].forEach(button => {
            button.disabled = value || button.dataset.available === "false";
        });
        view.ariaBusy = String(value);
    };
    const complete = (message: string): void => {
        showPopupToast(message);
        options.onComplete();
    };
    const setMode = (next: LoginMode): void => {
        mode = next;
        const signingUp = mode === "sign-up";
        loginMode.ariaPressed = String(!signingUp);
        signUpMode.ariaPressed = String(signingUp);
        nameField.hidden = !signingUp;
        password.autocomplete = signingUp ? "new-password" : "current-password";
        password.minLength = signingUp ? 8 : 1;
        forgot.hidden = signingUp;
        confirmationField.hidden = !signingUp;
        confirmation.required = signingUp;
        confirmation.minLength = signingUp ? 8 : 0;
        title.textContent = signingUp ? "Create account" : "Log in";
        introduction.textContent = signingUp
            ? "Create one account to keep your extension data in sync."
            : "Log in to sync your searches, blacklist and preferences.";
        submit.textContent = signingUp ? "Create account" : "Log in";
        setStatus();
    };
    loginMode.addEventListener("click", () => setMode("login"));
    signUpMode.addEventListener("click", () => setMode("sign-up"));
    confirmation.addEventListener("input", () => confirmation.setCustomValidity(""));
    forgot.addEventListener("click", async () => {
        if (busy || !email.reportValidity()) return;
        setBusy(true);
        setStatus();
        try {
            await requestPasswordReset(email.value);
            setStatus("If an account exists for that email, a reset link is on its way.");
        } catch (error) {
            setStatus(error instanceof Error ? error.message : "Could not send the reset email.", true);
        } finally {
            setBusy(false);
        }
    });
    form.addEventListener("submit", async event => {
        event.preventDefault();
        if (busy || !form.reportValidity()) return;
        setBusy(true);
        setStatus();
        try {
            if (mode === "sign-up") {
                if (password.value !== confirmation.value) {
                    confirmation.setCustomValidity("Passwords do not match.");
                    confirmation.reportValidity();
                    setStatus("Passwords do not match.", true);
                    return;
                }
                await createEmailAccount(email.value, password.value, name.value);
                complete("Account created. Check your email to verify it.");
            } else {
                await loginWithEmail(email.value, password.value);
                complete("Logged in successfully");
            }
        } catch (error) {
            setStatus(error instanceof Error ? error.message : "Login did not complete.", true);
        } finally {
            setBusy(false);
        }
    });

    const labels: Record<SocialProvider, string> = {
        apple: "Apple",
        facebook: "Facebook",
        google: "Google",
    };
    for (const provider of ["google", "apple", "facebook"] as const) {
        const button = document.createElement("button");
        const available = options.account?.capabilities[provider] ?? false;
        if (!available) continue;
        button.className = "edf-popup-auth-provider";
        button.type = "button";
        button.append(createProviderMark(provider), document.createTextNode(labels[provider]));
        button.addEventListener("click", async () => {
            if (busy) return;
            setBusy(true);
            setStatus();
            try {
                await loginWithProvider(provider);
                complete(`Logged in with ${labels[provider]}`);
            } catch (error) {
                setStatus(error instanceof Error ? error.message : `${labels[provider]} login did not complete.`, true);
            } finally {
                setBusy(false);
            }
        });
        providerButtons.push(button);
        providers.append(button);
    }

    image.className = "edf-popup-login-image";
    image.setAttribute("aria-label", "Contemporary Australian home interior");
    divider.hidden = providerButtons.length === 0;
    form.append(nameField, emailField, passwordField, confirmationField, forgot, submit, status);
    header.append(back, brand);
    content.append(title, introduction, modes, form, divider, providers);
    panel.append(header, content);
    view.append(panel, image);
    setMode("login");
    return view;
}
