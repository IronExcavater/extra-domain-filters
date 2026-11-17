export interface TabOption<T extends string> {
    label: string;
    value: T;
}

// Tab rows are rebuilt on re-render. A new row starts on the tab the previous row had selected
// and switches a frame later, so each tab's own underline (CSS ::after) still animates across.
const lastSelected = new Map<string, string>();

export function createTabs<T extends string>(options: {
    active: T;
    /** Remembers the selection across re-renders of the same tab row. */
    indicatorKey?: string;
    onChange(value: T): void;
    options: readonly TabOption<T>[];
    signal: AbortSignal;
}): HTMLElement {
    const tabs = document.createElement("div");
    const key = options.indicatorKey ?? options.options.map(option => option.value).join("|");
    const select = (value: string): void => {
        lastSelected.set(key, value);
        tabs.querySelectorAll<HTMLButtonElement>("button").forEach(button => {
            button.ariaSelected = String(button.dataset.value === value);
        });
    };

    tabs.className = "edf-collection-tabs";
    tabs.setAttribute("role", "tablist");
    options.options.forEach(option => {
        const tab = document.createElement("button");

        tab.className = "edf-collection-tab";
        tab.type = "button";
        tab.dataset.value = option.value;
        tab.setAttribute("role", "tab");
        tab.textContent = option.label;
        tab.addEventListener("click", () => {
            select(option.value);
            options.onChange(option.value);
        }, { signal: options.signal });
        tabs.append(tab);
    });

    const previous = lastSelected.get(key);
    if (previous && previous !== options.active && options.options.some(option => option.value === previous)) {
        select(previous);
        requestAnimationFrame(() => requestAnimationFrame(() => {
            if (!options.signal.aborted) select(options.active);
        }));
    } else {
        select(options.active);
    }

    return tabs;
}
