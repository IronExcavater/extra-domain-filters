export interface TabOption<T extends string> {
    label: string;
    value: T;
}

export function createTabs<T extends string>(options: {
    active: T;
    /** Remembers the underline position across re-renders of the same tab row. */
    indicatorKey?: string;
    onChange(value: T): void;
    options: readonly TabOption<T>[];
    signal: AbortSignal;
}): HTMLElement {
    const tabs = document.createElement("div");

    tabs.className = "edf-collection-tabs";
    tabs.setAttribute("role", "tablist");
    options.options.forEach(option => {
        const tab = document.createElement("button");

        tab.className = "edf-collection-tab";
        tab.type = "button";
        tab.dataset.value = option.value;
        tab.setAttribute("role", "tab");
        tab.ariaSelected = String(option.value === options.active);
        tab.textContent = option.label;
        tab.addEventListener("click", () => {
            tabs.querySelectorAll<HTMLButtonElement>("button").forEach(button => {
                button.ariaSelected = String(button.dataset.value === option.value);
            });
            options.onChange(option.value);
        }, { signal: options.signal });
        tabs.append(tab);
    });
    attachTabIndicator(tabs, options.indicatorKey ?? options.options.map(option => option.value).join("|"), options.signal);

    return tabs;
}

const lastIndicatorPositions = new Map<string, { left: number; width: number }>();

/**
 * One green underline that slides between tabs instead of each tab scaling its own. Rows are
 * often rebuilt on re-render, so the last position is remembered per `key` and a new row
 * starts there before gliding to its selected tab.
 */
export function attachTabIndicator(tablist: HTMLElement, key: string, signal?: AbortSignal): void {
    const indicator = document.createElement("span");
    indicator.className = "edf-collection-tab-indicator";
    indicator.ariaHidden = "true";
    tablist.classList.add("edf-collection-tabs-indicated");
    tablist.append(indicator);

    const move = (left: number, width: number, animate: boolean): void => {
        if (!animate) indicator.dataset.instant = "true";
        indicator.style.transform = `translateX(${left}px)`;
        indicator.style.width = `${width}px`;
        if (!animate) {
            void indicator.offsetWidth;
            delete indicator.dataset.instant;
        }
    };
    const place = (animate: boolean): void => {
        const selected = tablist.querySelector<HTMLElement>('[role="tab"][aria-selected="true"]');
        indicator.dataset.visible = String(Boolean(selected));
        if (!selected) return;
        move(selected.offsetLeft, selected.offsetWidth, animate);
        lastIndicatorPositions.set(key, { left: selected.offsetLeft, width: selected.offsetWidth });
    };

    requestAnimationFrame(() => {
        const previous = lastIndicatorPositions.get(key);
        if (!previous) {
            place(false);
            return;
        }
        indicator.dataset.visible = "true";
        move(previous.left, previous.width, false);
        requestAnimationFrame(() => place(true));
    });

    const selection = new MutationObserver(() => place(true));
    selection.observe(tablist, { attributeFilter: ["aria-selected"], attributes: true, subtree: true });
    let observedOnce = false;
    const resize = new ResizeObserver(() => {
        if (observedOnce) place(false);
        observedOnce = true;
    });
    resize.observe(tablist);
    signal?.addEventListener("abort", () => {
        selection.disconnect();
        resize.disconnect();
    }, { once: true });
}
