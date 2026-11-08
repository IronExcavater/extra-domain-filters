import { isOwnedNode } from "../dom/ownership";
import { waitForElement } from "../dom/wait";
import type { DomainPageFailure, DomainPageResult } from "./action";

export type DomainAlertFrequency = "daily" | "none" | "weekly";
export type DomainAlertFailure = DomainPageFailure;

export type DomainAlertResult = DomainPageResult<{ frequency: DomainAlertFrequency }>;

export interface DomainAlertRequest {
    frequency: DomainAlertFrequency;
    signal: AbortSignal;
    trigger: HTMLButtonElement;
}

export interface DomainAlertApplyMessage {
    domainId?: string;
    frequency: DomainAlertFrequency;
    type: "edf:domain-alert:apply";
}

export function isDomainAlertApplyMessage(value: unknown): value is DomainAlertApplyMessage {
    if (!value || typeof value !== "object") return false;
    const candidate = value as Partial<DomainAlertApplyMessage>;
    return candidate.type === "edf:domain-alert:apply"
        && ["daily", "none", "weekly"].includes(candidate.frequency ?? "")
        && (candidate.domainId === undefined || typeof candidate.domainId === "string");
}

export interface DomainAlertBridge {
    apply(request: DomainAlertRequest): Promise<DomainAlertResult>;
}

interface ElementState {
    ariaHidden: string | null;
    element: HTMLElement;
    inert: boolean;
    style: string | null;
}

const FORM_TIMEOUT_MS = 4_000;
const ALERT_OBSERVE_OPTIONS: MutationObserverInit = {
    attributes: true,
    characterData: true,
    childList: true,
    subtree: true,
};

// Layout-based: Domain's edit tooltip stays mounted while closed (its wrapper goes display:none).
function isRendered(element: Element): boolean {
    return element.isConnected && element.getClientRects().length > 0;
}

// Domain's alert editor: a create modal (segmented Daily/Weekly buttons outside a submit-only
// form) or an edit tooltip form (Daily/Weekly/Never). Never our own popover, never a closed one.
function findAlertSurface(): HTMLElement | undefined {
    return [...document.querySelectorAll<HTMLElement>('[role="dialog"], [role="tooltip"], form')]
        .find(element => !isOwnedNode(element)
            && isRendered(element)
            && element.querySelector('button[type="submit"]') !== null
            && /receive alerts|email frequency|property alert/i.test(element.textContent ?? ""));
}

// Invisible but still laid out, so isRendered() keeps tracking Domain's own open/closed state.
function conceal(element: HTMLElement): ElementState {
    const state = {
        ariaHidden: element.getAttribute("aria-hidden"),
        element,
        inert: element.inert,
        style: element.getAttribute("style"),
    };
    element.style.setProperty("opacity", "0", "important");
    element.style.setProperty("pointer-events", "none", "important");
    element.inert = true;
    element.setAttribute("aria-hidden", "true");
    return state;
}

function restore(state: ElementState): void {
    state.element.inert = state.inert;
    if (state.style === null) state.element.removeAttribute("style");
    else state.element.setAttribute("style", state.style);
    if (state.ariaHidden === null) state.element.removeAttribute("aria-hidden");
    else state.element.setAttribute("aria-hidden", state.ariaHidden);
}

function frequencyPattern(frequency: DomainAlertFrequency): RegExp {
    if (frequency === "none") return /^(?:never|i don['’]t want alerts anymore)$/i;
    return new RegExp(`^${frequency}$`, "i");
}

async function chooseFrequency(
    surface: HTMLElement,
    frequency: DomainAlertFrequency,
    signal: AbortSignal,
): Promise<boolean> {
    const pattern = frequencyPattern(frequency);
    const choice = [...surface.querySelectorAll<HTMLElement>(
        'button[data-selected], [role="radio"], input[type="radio"], input[name*="frequency" i]',
    )].find(element => element instanceof HTMLInputElement
        ? pattern.test(element.value) || pattern.test(element.closest("label")?.textContent?.trim() ?? "")
        : pattern.test(element.textContent?.trim() ?? ""));
    if (choice) {
        choice.click();
        return true;
    }

    const combobox = surface.querySelector<HTMLButtonElement>('[role="combobox"]');
    if (!combobox) return false;
    combobox.click();
    const option = await waitForElement(() =>
        [...document.querySelectorAll<HTMLElement>('[role="option"]')]
            .find(candidate => pattern.test(candidate.textContent?.trim() ?? "")), signal,
        { observe: ALERT_OBSERVE_OPTIONS, timeoutMs: FORM_TIMEOUT_MS });
    option.click();
    return true;
}

function mapFailure(error: unknown): DomainAlertResult {
    if (error instanceof DOMException && error.name === "AbortError") {
        return { message: "Alert update cancelled.", ok: false, reason: "cancelled" };
    }
    if (error instanceof DOMException && error.name === "TimeoutError") {
        return { message: "Domain did not open its alert editor in time.", ok: false, reason: "timed-out" };
    }
    return {
        message: error instanceof Error ? error.message : "Domain rejected the alert update.",
        ok: false,
        reason: "rejected",
    };
}

export const domainAlertBridge: DomainAlertBridge = {
    async apply(request) {
        if (!request.trigger.isConnected) {
            return { message: "The Domain alert control is unavailable.", ok: false, reason: "unavailable" };
        }

        let state: ElementState | undefined;
        try {
            request.trigger.dataset.edfNativeAlertBridge = "true";
            request.trigger.click();
            delete request.trigger.dataset.edfNativeAlertBridge;
            const surface = await waitForElement(findAlertSurface, request.signal,
                { observe: ALERT_OBSERVE_OPTIONS, timeoutMs: FORM_TIMEOUT_MS });
            state = conceal(surface);
            if (!await chooseFrequency(surface, request.frequency, request.signal)) {
                return {
                    message: "Domain's alert frequency controls have changed.",
                    ok: false,
                    reason: "changed-markup",
                };
            }
            await new Promise<void>(resolve => requestAnimationFrame(() => resolve()));
            const submit = surface.querySelector<HTMLButtonElement>('button[type="submit"]');
            if (!submit) {
                return {
                    message: "Domain's alert submit control is unavailable.",
                    ok: false,
                    reason: "changed-markup",
                };
            }
            submit.click();
            await waitForElement(() => isRendered(submit) ? undefined : true, request.signal,
                { observe: ALERT_OBSERVE_OPTIONS, timeoutMs: FORM_TIMEOUT_MS });
            return { frequency: request.frequency, ok: true };
        } catch (error) {
            return mapFailure(error);
        } finally {
            delete request.trigger.dataset.edfNativeAlertBridge;
            if (state) restore(state);
        }
    },
};
