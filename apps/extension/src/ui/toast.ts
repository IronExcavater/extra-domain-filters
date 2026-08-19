import { markOwned } from "../dom/ownership";

const TOAST_TIMEOUT_MS = 4500;
export type ToastScope = "page" | "popup";

function createCheckIcon(): SVGSVGElement {
    const svg = document.createElementNS("http://www.w3.org/2000/svg", "svg");
    const path = document.createElementNS("http://www.w3.org/2000/svg", "path");

    svg.setAttribute("xmlns", "http://www.w3.org/2000/svg");
    svg.setAttribute("viewBox", "0 0 24 24");
    svg.setAttribute("aria-hidden", "true");
    svg.classList.add("domain-icon");
    path.setAttribute(
        "d",
        "M19.1992 5L20.6543 6.37305L7.62109 19.7647L3 14.9282L4.45508 13.5552L7.6211 16.8506L19.1992 5Z",
    );
    path.setAttribute("fill", "currentColor");
    svg.append(path);
    return svg;
}

function getToastTray(scope: ToastScope): HTMLElement {
    const existing = document.querySelector<HTMLElement>(
        `[data-testid="messages__toast"][data-edf-toast-scope="${scope}"]`,
    );
    if (existing) return existing;

    const tray = document.createElement("div");

    tray.className = "edf-toast-tray";
    tray.dataset.testid = "messages__toast";
    tray.dataset.edfToastScope = scope;
    document.body.append(markOwned(tray, "toast"));

    return tray;
}

export function showToast(message: string, scope: ToastScope = "page"): void {
    const tray = getToastTray(scope);
    const transition = document.createElement("div");
    const toast = document.createElement("div");
    const content = document.createElement("div");
    const icon = document.createElement("span");
    const text = document.createElement("span");
    const close = document.createElement("button");

    transition.className = "edf-toast-transition";
    toast.className = "edf-toast";
    toast.dataset.testid = "messages__message-wrapper";
    content.className = "edf-toast-content";
    icon.className = "edf-toast-icon";
    icon.dataset.testid = "message-icon";
    text.className = "edf-toast-text";
    text.dataset.testid = "messages__message-text";
    text.role = "alert";
    text.textContent = message;
    close.type = "button";
    close.className = "edf-toast-close";
    close.dataset.testid = "messages__message-close";
    close.textContent = "Hide";

    const remove = (): void => {
        transition.dataset.closing = "true";
        window.setTimeout(() => transition.remove(), 160);
    };
    close.addEventListener("click", remove);
    window.setTimeout(remove, TOAST_TIMEOUT_MS);

    icon.append(createCheckIcon());
    content.append(icon, text, close);
    toast.append(content);
    transition.append(markOwned(toast, "toast-message"));
    tray.append(transition);
}
