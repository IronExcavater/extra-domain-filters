import { markOwned } from "../dom/ownership";
import { createSvgIcon } from "./elements";
import { replaceWithCloseIcon } from "./icons";

const TOAST_TIMEOUT_MS = 4500;
const TOAST_EXIT_MS = 260;
export type ToastScope = "page" | "popup";

export interface ToastAction {
    label: string;
    onClick(): Promise<void> | void;
}

export interface ToastOptions {
    action?: ToastAction;
    durationMs?: number;
}

export interface ToastHandle {
    dismiss(): void;
}

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

export function showToast(
    message: string,
    scope: ToastScope = "page",
    options: ToastOptions = {},
): ToastHandle {
    const tray = getToastTray(scope);
    const transition = document.createElement("div");
    const clip = document.createElement("div");
    const toast = document.createElement("div");
    const content = document.createElement("div");
    const icon = document.createElement("span");
    const text = document.createElement("span");
    const action = options.action ? document.createElement("button") : undefined;
    const close = document.createElement("button");
    const duration = options.durationMs ?? TOAST_TIMEOUT_MS;
    let removed = false;
    let remaining = duration;
    let deadline = 0;
    let timeout: number | undefined;

    transition.className = "edf-toast-transition";
    clip.className = "edf-toast-clip";
    toast.className = "edf-toast";
    toast.dataset.testid = "messages__message-wrapper";
    content.className = "edf-toast-content";
    icon.className = "edf-toast-icon";
    icon.dataset.testid = "message-icon";
    text.className = "edf-toast-text";
    text.dataset.testid = "messages__message-text";
    text.role = "alert";
    text.textContent = message;
    if (action && options.action) {
        action.type = "button";
        action.className = "edf-toast-action";
        action.textContent = options.action.label;
    }
    close.type = "button";
    close.className = "edf-toast-close";
    close.dataset.testid = "messages__message-close";
    close.ariaLabel = "Dismiss notification";
    close.append(createSvgIcon(replaceWithCloseIcon, "edf-toast-close-icon"));

    const remove = (): void => {
        if (removed) return;
        removed = true;
        if (timeout !== undefined) {
            window.clearTimeout(timeout);
            timeout = undefined;
        }
        // The wrapper collapses its own height while fading, so the rest of the stack
        // slides into place continuously instead of jumping after the fade finishes.
        transition.dataset.state = "closing";
        const finishRemoval = (): void => {
            if (!transition.isConnected) return;
            transition.remove();
            if (tray.childElementCount === 0) tray.remove();
        };
        transition.addEventListener("transitionend", event => {
            if (event.target === transition && event.propertyName === "grid-template-rows") finishRemoval();
        });
        window.setTimeout(finishRemoval, window.matchMedia("(prefers-reduced-motion: reduce)").matches
            ? 0
            : TOAST_EXIT_MS + 80);
    };
    const startTimeout = (): void => {
        if (removed) return;
        if (remaining <= 0) {
            remove();
            return;
        }
        deadline = performance.now() + remaining;
        timeout = window.setTimeout(remove, remaining);
    };
    const pauseTimeout = (): void => {
        if (timeout === undefined) return;
        remaining = Math.max(0, deadline - performance.now());
        window.clearTimeout(timeout);
        timeout = undefined;
    };
    const resumeTimeout = (): void => {
        if (timeout !== undefined || removed) return;
        startTimeout();
    };
    close.addEventListener("click", remove);
    transition.addEventListener("pointerenter", pauseTimeout);
    transition.addEventListener("pointerleave", resumeTimeout);
    transition.addEventListener("focusin", pauseTimeout);
    transition.addEventListener("focusout", event => {
        if (event.relatedTarget instanceof Node && transition.contains(event.relatedTarget)) return;
        resumeTimeout();
    });
    action?.addEventListener("click", async () => {
        if (!options.action) return;
        action.disabled = true;
        try {
            await options.action.onClick();
            remove();
        } catch {
            action.disabled = false;
        }
    });
    startTimeout();

    icon.append(createCheckIcon());
    content.append(icon, text);
    if (action) content.append(action);
    content.append(close);
    toast.append(content);
    clip.append(markOwned(toast, "toast-message"));
    transition.append(clip);
    transition.dataset.state = "entering";
    tray.append(transition);
    void transition.offsetHeight;
    requestAnimationFrame(() => {
        if (!removed) transition.dataset.state = "open";
    });

    return { dismiss: remove };
}
