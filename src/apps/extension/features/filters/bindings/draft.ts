import { createClaimTracker } from "../../../dom/claim";
import type { LifecycleScope } from "../../../platform/lifecycle";
import { Property, PropertyKind, PropertyValue } from "../../../state/property";

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

const submitSelector = [
    'button[data-testid="submit-button"]',
    'button[type="submit"]',
    'button[aria-label*="Search" i]',
    'button[aria-label*="Apply" i]',
].join(', ');

export async function createDraftProperty<K extends PropertyKind>(
    element: Element,
    target: Property<K>,
    defaultValue: PropertyValue<K>,
    lifecycle: LifecycleScope,
): Promise<Property<K>> {
    const scope = element.closest('[role="dialog"]') ?? document.body;

    const submit = scope.querySelector<HTMLButtonElement>(submitSelector);

    if (!submit) {
        lifecycle.add(() => target.dispose());
        return target;
    }

    let confirmed = await target.get();

    const property = Property.value(target.kind, confirmed);

    let drafts = draftsByScope.get(scope);

    if (!drafts) {
        drafts = new Set();
        draftsByScope.set(scope, drafts);
    }

    const entry: DraftEntry = {
        reset: async () => {
            await property.set(defaultValue);
            await target.set(defaultValue);
            confirmed = defaultValue;
        },
        restore: () => property.set(confirmed),
        commit: async () => {
            const next = await property.get();
            confirmed = next;
            await target.set(next);
        },
    };
    drafts.add(entry);
    lifecycle.add(() => {
        drafts.delete(entry);
        property.dispose();
        target.dispose();
    });

    bindScope(scope, drafts);

    return property;
}

function ignoreDraftError(error: unknown): void {
    if (error instanceof Error && /extension context invalidated|context invalidated/i.test(error.message)) return;
    console.warn("[Extra Domain Filters] Failed to synchronize filter draft", error);
}

function bindScope(scope: Element, drafts: Set<DraftEntry>): void {
    if (!claimScope(scope)) return;

    const commit = (): void => {
        for (const draft of drafts) void draft.commit().catch(ignoreDraftError);
    };

    scope.addEventListener('click', event => {
        const target = event.target;
        if (!(target instanceof Element)) return;

        if (target.closest(submitSelector)) {
            commit();
            return;
        }

        if (target.closest(clearSelector)) {
            for (const draft of drafts) void draft.reset().catch(ignoreDraftError);
        }
    }, { capture: true });

    scope.addEventListener('submit', commit, { capture: true });

    if (scope instanceof HTMLElement && scope.getAttribute('role') === 'dialog') {
        const observer = new MutationObserver(() => {
            if (scope.getAttribute('aria-hidden') !== 'true') return;

            for (const draft of drafts) void draft.restore().catch(ignoreDraftError);
        });

        observer.observe(scope, { attributes: true, attributeFilter: ['aria-hidden'] });
    }
}
