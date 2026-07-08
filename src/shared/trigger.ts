import { PageContext } from "./router";

// Binds click on any of the given buttons to: wait for targetSelector to appear in the DOM
// (Domain renders whatever panel the button opens asynchronously after the click), then run
// onReady once. Not filters-specific — any "click opens a panel I need to react to once it
// exists" flow (e.g. an account menu) can reuse this instead of hand-rolling its own
// click+MutationObserver+signal wiring.
export function bindLazyTrigger(
    selectors: string[],
    targetSelector: string,
    onReady: (context: PageContext) => void,
    context: PageContext,
): void {
    document.querySelectorAll(selectors.join(', ')).forEach(button => {
        button.addEventListener('click', () => {
            context.logger.info('Trigger clicked', selectors.join(', '));

            // If the target already exists (e.g. a menu whose DOM persists across close/reopen,
            // just toggling visibility, unlike a panel that's fully torn down and re-rendered),
            // there's no new mutation to wait for — a MutationObserver alone would never fire and
            // onReady would only ever run on the very first open.
            if (document.querySelectorAll(targetSelector).length > 0) {
                onReady(context);
                return;
            }

            const observer = new MutationObserver(() => {
                if (document.querySelectorAll(targetSelector).length === 0) return;

                onReady(context);
                observer.disconnect();
            });

            context.signal.addEventListener('abort', () => {
                observer.disconnect();
            });

            observer.observe(document.body, { childList: true, subtree: true });
        }, { signal: context.signal });
    });
}
