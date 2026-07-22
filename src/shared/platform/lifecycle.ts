export type Disposer = () => void;

export interface LifecycleScope {
    readonly label: string;
    readonly signal: AbortSignal;
    readonly disposed: boolean;
    readonly resourceCount: number;
    add(disposer: Disposer): Disposer;
    child(label?: string): LifecycleScope;
    dispose(): void;
}

export interface LifecycleSnapshot {
    label: string;
    resourceCount: number;
}

const activeScopes = new Set<LifecycleScope>();

function once(disposer: Disposer): Disposer {
    let active = true;

    return () => {
        if (!active) return;
        active = false;
        disposer();
    };
}

export function createLifecycleScope(
    parentSignal?: AbortSignal,
    label = "scope",
): LifecycleScope {
    const controller = new AbortController();
    const disposers: Disposer[] = [];

    const scope: LifecycleScope = {
        label,
        signal: controller.signal,
        get disposed() {
            return controller.signal.aborted;
        },
        get resourceCount() {
            return disposers.length;
        },
        add(disposer) {
            const registered = once(disposer);

            if (controller.signal.aborted) {
                registered();
                return registered;
            }

            disposers.push(registered);

            return once(() => {
                const index = disposers.indexOf(registered);
                if (index >= 0) disposers.splice(index, 1);
                registered();
            });
        },
        child(childLabel = "child") {
            const child = createLifecycleScope(undefined, `${label}/${childLabel}`);
            const unregister = scope.add(() => child.dispose());
            child.add(unregister);
            return child;
        },
        dispose() {
            if (controller.signal.aborted) return;

            controller.abort();

            const errors: unknown[] = [];
            for (let index = disposers.length - 1; index >= 0; index--) {
                try {
                    disposers[index]();
                } catch (error) {
                    errors.push(error);
                }
            }
            disposers.length = 0;
            activeScopes.delete(scope);

            if (errors.length > 0) console.error(
                `[Extra Domain Filters] Failed to dispose lifecycle scope "${label}"`,
                new AggregateError(errors),
            );
        },
    };

    activeScopes.add(scope);

    if (parentSignal) {
        if (parentSignal.aborted) {
            scope.dispose();
        } else {
            const disposeFromParent = (): void => scope.dispose();
            parentSignal.addEventListener("abort", disposeFromParent, { once: true });
            scope.add(() => parentSignal.removeEventListener("abort", disposeFromParent));
        }
    }

    return scope;
}

export function getLifecycleSnapshot(): LifecycleSnapshot[] {
    return [...activeScopes].map(scope => ({
        label: scope.label,
        resourceCount: scope.resourceCount,
    }));
}
