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
    hidden: boolean | "until-found";
    inert: boolean;
}

const FORM_TIMEOUT_MS = 4_000;
const ALERT_OBSERVE_OPTIONS: MutationObserverInit = {
    attributes: true,
    characterData: true,
    childList: true,
    subtree: true,
};

function findAlertForm(): HTMLFormElement | undefined {
    return [...document.querySelectorAll<HTMLFormElement>(
        '[role="dialog"] form, [role="tooltip"] form, form',
    )].find(form =>
        form.querySelector('[role="combobox"], input[name*="frequency" i]') !== null
        || /receive alerts|email frequency|property alert/i.test(form.textContent ?? ""),
    );
}

function conceal(element: HTMLElement): ElementState {
    const state = {
        ariaHidden: element.getAttribute("aria-hidden"),
        element,
        hidden: element.hidden,
        inert: element.inert,
    };
    element.hidden = true;
    element.inert = true;
    element.setAttribute("aria-hidden", "true");
    return state;
}

function restore(state: ElementState): void {
    state.element.hidden = state.hidden;
    state.element.inert = state.inert;
    if (state.ariaHidden === null) state.element.removeAttribute("aria-hidden");
    else state.element.setAttribute("aria-hidden", state.ariaHidden);
}

function frequencyPattern(frequency: DomainAlertFrequency): RegExp {
    if (frequency === "none") return /^(?:never|i don['’]t want alerts anymore)$/i;
    return new RegExp(`^${frequency}$`, "i");
}

async function chooseFrequency(
    form: HTMLFormElement,
    frequency: DomainAlertFrequency,
    signal: AbortSignal,
): Promise<boolean> {
    const pattern = frequencyPattern(frequency);
    const radio = [...form.querySelectorAll<HTMLInputElement>('input[type="radio"], input[name*="frequency" i]')]
        .find(input => pattern.test(input.value) || pattern.test(input.closest("label")?.textContent?.trim() ?? ""));
    if (radio) {
        radio.click();
        return true;
    }

    const combobox = form.querySelector<HTMLButtonElement>('[role="combobox"]');
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
            const form = await waitForElement(findAlertForm, request.signal,
                { observe: ALERT_OBSERVE_OPTIONS, timeoutMs: FORM_TIMEOUT_MS });
            const surface = form.closest<HTMLElement>('[role="dialog"], [role="tooltip"]') ?? form;
            state = conceal(surface);
            if (!await chooseFrequency(form, request.frequency, request.signal)) {
                return {
                    message: "Domain's alert frequency controls have changed.",
                    ok: false,
                    reason: "changed-markup",
                };
            }
            await new Promise<void>(resolve => requestAnimationFrame(() => resolve()));
            const submit = form.querySelector<HTMLButtonElement>('button[type="submit"]');
            if (!submit) {
                return {
                    message: "Domain's alert submit control is unavailable.",
                    ok: false,
                    reason: "changed-markup",
                };
            }
            submit.click();
            await waitForElement(() => form.isConnected ? undefined : true, request.signal,
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
