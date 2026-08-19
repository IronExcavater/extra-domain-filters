import { PageContext } from "../platform/router";

export function bindLazyTrigger(
    selectors: string[],
    targetSelector: string,
    onReady: (context: PageContext) => void,
    context: PageContext,
): void {
    let frame: number | undefined;
    let observer: MutationObserver | undefined;

    const findClickedSelector = (target: EventTarget | null): string | undefined =>
        selectors.find(selector =>
            target instanceof Element && Boolean(target.closest(selector))
        );

    const findTarget = (): Element | undefined =>
        [...document.querySelectorAll(targetSelector)].find(element =>
            element.getClientRects().length > 0
        );

    const waitForTarget = (): void => {
        if (frame !== undefined || observer) return;

        frame = requestAnimationFrame(() => {
            frame = undefined;
            if (findTarget()) {
                onReady(context);
                return;
            }

            observer = new MutationObserver(() => {
                if (!findTarget()) return;

                observer?.disconnect();
                observer = undefined;
                onReady(context);
            });

            observer.observe(document.body, { childList: true, subtree: true });
        });
    };

    context.scope.add(() => {
        if (frame !== undefined) cancelAnimationFrame(frame);
        observer?.disconnect();
    });

    document.addEventListener('click', event => {
        const selector = findClickedSelector(event.target);
        if (!selector) return;

        context.logger.info('Trigger clicked', selector);
        waitForTarget();
    }, { signal: context.signal, capture: true });
}
