import { type LifecycleScope } from "../platform/lifecycle";
import { hasExternalMutation, onBodyMutations } from "./bodyMutations";
import { markOwned } from "./ownership";
import { createFrameReconciler } from "./reconcile";

export interface ReplacementTarget {
    host: HTMLElement;
    native?: HTMLElement;
}

export interface ReplacementSlotOptions {
    mount(target: ReplacementTarget, root: HTMLElement): void;
    onError(error: unknown): void;
    owner: string;
    render(root: HTMLElement, target: ReplacementTarget): Promise<void> | void;
    resolve(): ReplacementTarget | undefined;
}

export interface ReplacementSlot {
    schedule(): void;
}

interface NativeState {
    ariaHidden: string | null;
    element: HTMLElement;
    hidden: boolean | "until-found";
    inert: boolean;
}

function hideNative(element: HTMLElement): NativeState {
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

function restoreNative(state?: NativeState): void {
    if (!state) return;
    state.element.hidden = state.hidden;
    state.element.inert = state.inert;
    if (state.ariaHidden === null) state.element.removeAttribute("aria-hidden");
    else state.element.setAttribute("aria-hidden", state.ariaHidden);
}

export function createReplacementSlot(
    scope: LifecycleScope,
    options: ReplacementSlotOptions,
): ReplacementSlot {
    let current: ReplacementTarget | undefined;
    let nativeState: NativeState | undefined;
    let root: HTMLElement | undefined;

    const unmount = (): void => {
        root?.remove();
        root = undefined;
        restoreNative(nativeState);
        nativeState = undefined;
        current = undefined;
    };
    const reconciler = createFrameReconciler(scope, async () => {
        const target = options.resolve();
        if (!target) {
            unmount();
            return;
        }

        if (!root || current?.host !== target.host || current.native !== target.native) {
            unmount();
            current = target;
            nativeState = target.native ? hideNative(target.native) : undefined;
            root = markOwned(document.createElement("div"), options.owner);
            options.mount(target, root);
        }

        await options.render(root, target);
    }, options.onError);

    onBodyMutations(mutations => {
        if (hasExternalMutation(mutations)) reconciler.schedule();
    }, scope.signal);
    scope.add(unmount);
    reconciler.schedule();

    return { schedule: reconciler.schedule };
}
