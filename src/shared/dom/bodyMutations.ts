import { isOwnedNode } from "./ownership";

export type BodyMutationListener = (mutations: readonly MutationRecord[]) => void;

let observer: MutationObserver | undefined;
let frame: number | undefined;
let pending: MutationRecord[] = [];
const listeners = new Set<BodyMutationListener>();

function isExternalMutation(mutation: MutationRecord): boolean {
    if (isOwnedNode(mutation.target)) return false;

    const changedNodes = [...mutation.addedNodes, ...mutation.removedNodes];
    return changedNodes.length === 0 || changedNodes.some(node => !isOwnedNode(node));
}

export function hasExternalMutation(mutations: readonly MutationRecord[]): boolean {
    return mutations.some(isExternalMutation);
}

function flush(): void {
    frame = undefined;
    const mutations = pending;
    pending = [];
    for (const listener of listeners) listener(mutations);
}

function teardownIfIdle(): void {
    if (listeners.size > 0) return;

    observer?.disconnect();
    observer = undefined;
    if (frame !== undefined) {
        cancelAnimationFrame(frame);
        frame = undefined;
    }
    pending = [];
}

/**
 * A single document.body/subtree MutationObserver shared by every feature that needs one,
 * instead of each feature running its own. Domain's own page mutates constantly (infinite
 * scroll, lazy images, ads), so N independent observers each re-scanning on every batch is
 * the dominant cost on the search page. Callbacks are coalesced to one flush per animation
 * frame, batching bursts of synchronous mutations into a single delivery per listener.
 */
export function onBodyMutations(listener: BodyMutationListener, signal: AbortSignal): void {
    if (signal.aborted) return;

    if (!observer) {
        observer = new MutationObserver(mutations => {
            const external = mutations.filter(isExternalMutation);
            if (external.length === 0) return;
            pending.push(...external);
            if (frame === undefined) frame = requestAnimationFrame(flush);
        });
        observer.observe(document.body, { childList: true, subtree: true });
    }

    listeners.add(listener);
    signal.addEventListener("abort", () => {
        listeners.delete(listener);
        teardownIfIdle();
    }, { once: true });
}
