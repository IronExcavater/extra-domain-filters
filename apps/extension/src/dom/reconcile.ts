import { type LifecycleScope } from "../platform/lifecycle";

export interface FrameReconciler {
    schedule(): void;
    dispose(): void;
}

export function createFrameReconciler(
    scope: LifecycleScope,
    reconcile: () => Promise<void> | void,
    onError: (error: unknown) => void,
): FrameReconciler {
    let frame: number | undefined;
    let running = false;
    let rerun = false;

    const schedule = (): void => {
        if (scope.disposed) return;
        if (running) {
            rerun = true;
            return;
        }
        if (frame !== undefined) return;

        frame = requestAnimationFrame(() => {
            frame = undefined;
            running = true;

            void Promise.resolve()
                .then(reconcile)
                .catch(onError)
                .finally(() => {
                    running = false;
                    if (!scope.disposed && rerun) {
                        rerun = false;
                        schedule();
                    }
                });
        });
    };

    const dispose = (): void => {
        rerun = false;
        if (frame === undefined) return;
        cancelAnimationFrame(frame);
        frame = undefined;
    };

    scope.add(dispose);

    return { schedule, dispose };
}
