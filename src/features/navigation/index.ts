import { onBodyMutations } from "../../shared/dom/bodyMutations";
import type { PageContext } from "../../shared/platform/router";

const chevronControls = new WeakSet<HTMLElement>();

function bindAccountChevron(button: HTMLButtonElement, context: PageContext): void {
    if (chevronControls.has(button)) return;
    chevronControls.add(button);

    const setOpen = (open: boolean): void => {
        button.dataset.edfNavigationOpen = String(open);
    };

    button.addEventListener("click", () => {
        setOpen(button.dataset.edfNavigationOpen !== "true");
    }, { signal: context.signal });
    document.addEventListener("pointerdown", event => {
        if (!button.contains(event.target as Node)) setOpen(false);
    }, { capture: true, signal: context.signal });
    document.addEventListener("keydown", event => {
        if (event.key === "Escape") setOpen(false);
    }, { signal: context.signal });
    context.scope.add(() => delete button.dataset.edfNavigationOpen);
}

function bindMenuChevron(control: HTMLElement, context: PageContext): void {
    if (chevronControls.has(control)) return;
    chevronControls.add(control);

    const sync = (): void => {
        control.dataset.edfNavigationOpen = String(control.getAttribute("aria-expanded") === "true");
    };

    const observer = new MutationObserver(sync);

    sync();
    control.addEventListener("click", () => requestAnimationFrame(sync), { signal: context.signal });
    observer.observe(control, { attributes: true, attributeFilter: ["aria-expanded"] });
    context.scope.add(() => {
        observer.disconnect();
        delete control.dataset.edfNavigationOpen;
    });
}

export function enableNavigationChevronAnimation(context: PageContext): void {
    const bind = (): void => {
        for (const button of document.querySelectorAll<HTMLButtonElement>(
            'header.header[role="banner"] button[aria-label="User profile"]',
        )) {
            bindAccountChevron(button, context);
        }
        for (const control of document.querySelectorAll<HTMLElement>(
            'header.header[role="banner"] :is(a, button)[aria-haspopup="true"]',
        )) {
            bindMenuChevron(control, context);
        }
    };

    bind();
    onBodyMutations(bind, context.signal);
}

export function enableStickyHeader(context: PageContext): void {
    document.documentElement.dataset.edfStickyHeader = "true";
    const header = document.querySelector<HTMLElement>(
        'header.header[role="banner"] > section.css-a5sdz5 + div',
    );
    const headerRoot = header?.closest<HTMLElement>('header.header[role="banner"]');
    const sentinel = document.createElement("span");

    if (header && headerRoot) {
        sentinel.ariaHidden = "true";
        sentinel.style.cssText = "display:block;height:1px;margin:0;pointer-events:none;";
        headerRoot.before(sentinel);
        const observer = new IntersectionObserver(([entry]) => {
            header.dataset.edfStuck = String(!entry.isIntersecting);
        });

        observer.observe(sentinel);
        context.scope.add(() => {
            observer.disconnect();
            sentinel.remove();
            delete header.dataset.edfStuck;
        });
    }
    context.scope.add(() => {
        delete document.documentElement.dataset.edfStickyHeader;
    });
}
