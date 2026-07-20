import { createClaimTracker } from "../../../shared/dom/claim";
import { Property, PropertyKind, PropertyValue } from "../../../shared/state/property";

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
): Promise<Property<K>> {
    const scope = element.closest('[role="dialog"]') ?? document.body;

    const submit = scope.querySelector<HTMLButtonElement>(submitSelector);

    if (!submit) return target;

    let confirmed = await target.get();

    const property = Property.value(target.kind, confirmed);

    let drafts = draftsByScope.get(scope);

    if (!drafts) {
        drafts = new Set();
        draftsByScope.set(scope, drafts);
    }

    drafts.add({
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
    });

    bindScope(scope, drafts);

    return property;
}

function bindScope(scope: Element, drafts: Set<DraftEntry>): void {
    if (!claimScope(scope)) return;

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
