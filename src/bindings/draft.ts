import { createClaimTracker } from "../shared/claim";
import { Property, PropertyKind, PropertyValue } from "../shared/property";

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
        reset: () => property.set(defaultValue),
        restore: () => property.set(confirmed),
        commit: async () => {
            await target.set(await property.get());
            confirmed = await property.get();
        },
    });

    bindScope(scope, drafts, submit);

    return property;
}

function bindScope(scope: Element, drafts: Set<DraftEntry>, submit: HTMLButtonElement): void {
    if (!claimScope(scope)) return;

    scope.querySelectorAll<HTMLButtonElement>(clearSelector)
        .forEach(button => {
            button.addEventListener('click', () => {
                for (const draft of drafts) void draft.reset();
            });
        });

    submit.addEventListener('click', () => {
        for (const draft of drafts) void draft.commit();
    });

    if (scope instanceof HTMLElement && scope.getAttribute('role') === 'dialog') {
        const observer = new MutationObserver(() => {
            if (scope.getAttribute('aria-hidden') !== 'true') return;

            for (const draft of drafts) void draft.restore();
        });

        observer.observe(scope, { attributes: true, attributeFilter: ['aria-hidden'] });
    }
}
