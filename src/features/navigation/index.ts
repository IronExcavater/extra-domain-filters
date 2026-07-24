import { onBodyMutations } from "../../shared/dom/bodyMutations";
import type { PageContext } from "../../shared/platform/router";

const chevronControls = new WeakSet<HTMLElement>();

function bindAccountChevron(button: HTMLButtonElement, context: PageContext): void {
    const carrier = button.closest<HTMLElement>('[data-testid="header-member__dropdown"]') ?? button;
    if (chevronControls.has(carrier)) return;
    chevronControls.add(carrier);

    const setOpen = (open: boolean): void => {
        carrier.dataset.edfNavigationOpen = String(open);
    };
    const trigger = (): HTMLButtonElement | null => carrier.querySelector('button[aria-label="User profile"]');

    carrier.addEventListener("pointerdown", event => {
        if (!trigger()?.contains(event.target as Node)) return;
        setOpen(carrier.dataset.edfNavigationOpen !== "true");
    }, { capture: true, signal: context.signal });
    carrier.addEventListener("keydown", event => {
        if (event.key === "Enter" || event.key === " ") {
            setOpen(carrier.dataset.edfNavigationOpen !== "true");
        }
    }, { signal: context.signal });
    document.addEventListener("pointerdown", event => {
        if (!carrier.contains(event.target as Node)) setOpen(false);
    }, { capture: true, signal: context.signal });
    document.addEventListener("keydown", event => {
        if (event.key === "Escape") setOpen(false);
    }, { signal: context.signal });
    context.scope.add(() => delete carrier.dataset.edfNavigationOpen);
}

function bindMenuChevron(control: HTMLElement, context: PageContext): void {
    const menuItem = control.closest<HTMLElement>('[data-testid="header-menu-desktop-option"]');
    if (!menuItem || chevronControls.has(menuItem)) return;
    chevronControls.add(menuItem);

    const trigger = (): HTMLElement | null => menuItem.querySelector(":scope > a");
    const sync = (): void => {
        const expanded = trigger()?.getAttribute("aria-expanded");
        if (expanded !== null) menuItem.dataset.edfNavigationOpen = expanded;
    };
    const setOpen = (open: boolean): void => {
        menuItem.dataset.edfNavigationOpen = String(open);
    };

    const observer = new MutationObserver(sync);

    sync();
    menuItem.addEventListener("pointerdown", event => {
        if (!trigger()?.contains(event.target as Node)) return;
        setOpen(menuItem.dataset.edfNavigationOpen !== "true");
    }, { capture: true, signal: context.signal });
    menuItem.addEventListener("keydown", event => {
        if (event.key === "Enter" || event.key === " ") {
            setOpen(menuItem.dataset.edfNavigationOpen !== "true");
        }
    }, { signal: context.signal });
    document.addEventListener("pointerdown", event => {
        if (!menuItem.contains(event.target as Node)) setOpen(false);
    }, { capture: true, signal: context.signal });
    document.addEventListener("keydown", event => {
        if (event.key === "Escape") setOpen(false);
    }, { signal: context.signal });
    observer.observe(menuItem, {
        attributes: true,
        attributeFilter: ["aria-expanded"],
        childList: true,
        subtree: true,
    });
    context.scope.add(() => {
        observer.disconnect();
        delete menuItem.dataset.edfNavigationOpen;
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
            'header.header[role="banner"] [data-testid="header-menu-desktop-option"] > a:has(.css-1ohxmtf)',
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
