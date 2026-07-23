export interface TabOption<T extends string> {
    label: string;
    value: T;
}

export function createTabs<T extends string>(options: {
    active: T;
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

    return tabs;
}
