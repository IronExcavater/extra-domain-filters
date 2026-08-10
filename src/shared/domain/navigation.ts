export interface NavigationMenuBinding {
    carrier: HTMLElement;
    chevron: SVGElement;
    isOpen(): boolean;
    menu?: HTMLElement;
    trigger: HTMLElement;
}

function findControlledMenu(trigger: HTMLElement): HTMLElement | undefined {
    const controlledId = trigger.getAttribute("aria-controls");
    if (controlledId) return document.getElementById(controlledId) ?? undefined;

    if (trigger.id) {
        const labelled = document.querySelector<HTMLElement>(
            `[role="menu"][aria-labelledby="${CSS.escape(trigger.id)}"]`,
        );
        if (labelled) return labelled;
    }

    return undefined;
}

function findLocalMenu(carrier: HTMLElement, trigger: HTMLElement): HTMLElement | undefined {
    return findControlledMenu(trigger)
        ?? carrier.querySelector<HTMLElement>('[role="menu"], [role="listbox"], [data-testid*="menu" i], :scope > ul')
        ?? [...carrier.children].find((child): child is HTMLElement =>
            child instanceof HTMLElement && child !== trigger && child.querySelector("a, button") !== null,
        );
}

function isVisible(element?: HTMLElement): boolean {
    if (!element?.isConnected || element.hidden || element.getAttribute("aria-hidden") === "true") return false;
    const style = getComputedStyle(element);
    return style.display !== "none" && style.visibility !== "hidden" && element.getClientRects().length > 0;
}

function findChevron(trigger: HTMLElement): SVGElement | undefined {
    const candidates = [...trigger.querySelectorAll<SVGElement>("svg")]
        .filter(svg => svg.closest("a, button, summary") === trigger);
    return candidates.at(-1);
}

function createBinding(carrier: HTMLElement, trigger: HTMLElement): NavigationMenuBinding | undefined {
    const chevron = findChevron(trigger);
    if (!chevron) return undefined;
    const menu = findLocalMenu(carrier, trigger);

    return {
        carrier,
        chevron,
        isOpen: () => {
            const expanded = trigger.getAttribute("aria-expanded");
            if (expanded === "true") return true;
            if (expanded === "false") return false;
            if (carrier instanceof HTMLDetailsElement && carrier.open) return true;
            return isVisible(findLocalMenu(carrier, trigger));
        },
        menu,
        trigger,
    };
}

export function findNavigationMenus(): NavigationMenuBinding[] {
    const header = document.querySelector<HTMLElement>('header[role="banner"]');
    if (!header) return [];

    const bindings: NavigationMenuBinding[] = [];
    const carriers = new Set<HTMLElement>();
    const add = (carrier: HTMLElement, trigger?: HTMLElement): void => {
        if (!trigger || carriers.has(carrier)) return;
        const binding = createBinding(carrier, trigger);
        if (!binding) return;
        carriers.add(carrier);
        bindings.push(binding);
    };

    for (const carrier of header.querySelectorAll<HTMLElement>('[data-testid="header-menu-desktop-option"]')) {
        add(carrier, carrier.querySelector<HTMLElement>(":scope > a, :scope > button") ?? undefined);
    }
    for (const trigger of header.querySelectorAll<HTMLElement>(
        'button[aria-label="User profile"], button[aria-haspopup="menu"], summary',
    )) {
        const carrier = trigger.closest<HTMLElement>('[data-testid="header-member__dropdown"], details')
            ?? trigger.parentElement;
        if (carrier) add(carrier, trigger);
    }

    return bindings;
}

export function observeNavigationMenu(
    binding: NavigationMenuBinding,
    onChange: (open: boolean) => void,
    signal: AbortSignal,
): void {
    if (signal.aborted) return;

    let frame: number | undefined;
    const sync = (): void => {
        if (frame !== undefined) cancelAnimationFrame(frame);
        frame = requestAnimationFrame(() => {
            frame = undefined;
            onChange(binding.isOpen());
        });
    };
    const observer = new MutationObserver(sync);
    const scheduleSettledSync = (): void => {
        sync();
        requestAnimationFrame(sync);
    };

    observer.observe(binding.carrier, {
        attributeFilter: ["aria-expanded", "aria-hidden", "class", "hidden", "open", "style"],
        attributes: true,
        childList: true,
        subtree: true,
    });
    if (binding.menu && !binding.carrier.contains(binding.menu)) {
        observer.observe(binding.menu, {
            attributeFilter: ["aria-hidden", "class", "hidden", "style"],
            attributes: true,
            childList: true,
            subtree: true,
        });
    }
    for (const event of ["click", "focusin", "focusout", "keydown", "pointerenter", "pointerleave"] as const) {
        binding.carrier.addEventListener(event, scheduleSettledSync, { signal });
    }
    signal.addEventListener("abort", () => {
        observer.disconnect();
        if (frame !== undefined) cancelAnimationFrame(frame);
    }, { once: true });
    sync();
}
