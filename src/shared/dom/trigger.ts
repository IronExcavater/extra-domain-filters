import { PageContext } from "../platform/router";

export function bindLazyTrigger(
    selectors: string[],
    targetSelector: string,
    onReady: (context: PageContext) => void,
    context: PageContext,
): void {
    const findClickedSelector = (target: EventTarget | null): string | undefined =>
        selectors.find(selector =>
            target instanceof Element && Boolean(target.closest(selector))
        );

    const findTarget = (): Element | undefined =>
        [...document.querySelectorAll(targetSelector)].find(element =>
            element.getClientRects().length > 0
        );

    const waitForTarget = (ready: () => void): void => {
        requestAnimationFrame(() => {
            if (findTarget()) {
                ready();
                return;
            }

            const observer = new MutationObserver(() => {
                if (!findTarget()) return;

                observer.disconnect();
                ready();
            });

            context.signal.addEventListener('abort', () => observer.disconnect(), { once: true });
            observer.observe(document.body, { childList: true, subtree: true });
        });
    };

    document.addEventListener('click', event => {
        const selector = findClickedSelector(event.target);
        if (!selector) return;

        context.logger.info('Trigger clicked', selector);
        waitForTarget(() => onReady(context));
    }, { signal: context.signal, capture: true });
}
