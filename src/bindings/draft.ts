import { createClaimTracker } from "../core/claim";
import { Property, PropertyKind, PropertyValue } from "../core/property";

type DraftEntry = {
    reset(): Promise<void>;
    restore(): Promise<void>;
    commit(): Promise<void>;
};

const draftsByScope = new WeakMap<Element, Set<DraftEntry>>();
const claimScope = createClaimTracker<Element>();

const clearSelector = [
    'button[aria-label="Clear all filter selections"]',
    'button[class*="pill-clear-button"]',
].join(', ');

const submitSelector =
    'button[data-testid="submit-button"]';

export async function createDraftProperty<K extends PropertyKind>(
    element: Element,
    target: Property<K>,
    defaultValue: PropertyValue<K>,
): Promise<Property<K>> {
    const scope = element.closest('[role="dialog"]') ?? document.body;

    const submit = scope.querySelector<HTMLButtonElement>(submitSelector);

    // No submit step in this scope, persist immediately.
    if (!submit) return target;

    // The last value persisted on commit
    let confirmed = await target.get();

    const property = Property.value(target.kind, confirmed);

    let drafts = draftsByScope.get(scope);

    if (!drafts) {
        drafts = new Set();
        draftsByScope.set(scope, drafts);
    }

    drafts.add({
        // "Clear all" is Domain's own immediate action (it resets its native filters and often
        // closes/navigates right away, unlike a per-field change which waits for "Apply") — so
        // this must persist the default now, not just update the draft's in-memory/UI value.
        // Persisting anything less left the underlying setting untouched, and if the dialog
        // closed immediately after, restore() would even revert the visible reset back to the
        // pre-clear value.
        reset: async () => {
            await property.set(defaultValue);
            await target.set(defaultValue);
            confirmed = defaultValue;
        },
        restore: () => property.set(confirmed),
        commit: async () => {
            await target.set(await property.get());
            confirmed = await property.get();
        },
    });

    bindScope(scope, drafts);

    return property;
}

function bindScope(scope: Element, drafts: Set<DraftEntry>): void {
    if (!claimScope(scope)) return;

    // Delegated on the (stable) scope element rather than bound directly to the current
    // submit/clear button nodes: Domain keeps the dialog wrapper mounted across opens but
    // re-renders its buttons as fresh elements each time, which left a directly-bound listener
    // attached to a stale, detached node after the first open — real clicks on the new visible
    // button never reached it again, so nothing committed after the first "Apply".
    scope.addEventListener('click', event => {
        const target = event.target;
        if (!(target instanceof Element)) return;

        if (target.closest(submitSelector)) {
            for (const draft of drafts) void draft.commit();
            return;
        }

        if (target.closest(clearSelector)) {
            for (const draft of drafts) void draft.reset();
        }
    });

    if (scope instanceof HTMLElement && scope.getAttribute('role') === 'dialog') {
        const observer = new MutationObserver(() => {
            if (scope.getAttribute('aria-hidden') !== 'true') return;

            for (const draft of drafts) void draft.restore();
        });

        observer.observe(scope, { attributes: true, attributeFilter: ['aria-hidden'] });
    }
}
