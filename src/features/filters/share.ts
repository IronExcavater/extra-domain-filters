import { getSettings } from "../../shared/state/settings";
import { replaceWithShareIcon } from "../../shared/ui/icons";
import { cloneActionButton } from "./clone/action";
import { syncSharedFilterParams } from "./searchParams";

async function copy(text: string): Promise<void> {
    if (navigator.clipboard?.writeText) {
        await navigator.clipboard.writeText(text);
        return;
    }

    const input = document.createElement("textarea");
    input.value = text;
    input.style.position = "fixed";
    document.body.append(input);
    input.select();
    document.execCommand("copy");
    input.remove();
}

export async function bindFilterShareButton(): Promise<void> {
    const source = document.querySelector<HTMLButtonElement>('button[name="property-alert"]');
    if (!source || source.parentElement?.querySelector('[data-testid="extra-domain-filters-share"]')) return;

    const button = cloneActionButton(source, {
        icon: replaceWithShareIcon,
        label: "Share filters",
    });
    const label = [...button.querySelectorAll<HTMLElement>("span")]
        .find(span => !span.querySelector("svg"));
    button.name = "extra-domain-filters-share";
    button.dataset.testid = "extra-domain-filters-share";
    button.ariaLabel = "Copy filtered search link";
    button.title = "Share filters";
    button.classList.add("edf-filter-share-button");
    source.parentElement?.classList.add("edf-filter-actions");
    button.addEventListener("click", async event => {
        event.preventDefault();
        syncSharedFilterParams(await getSettings());
        await copy(window.location.href);
        button.blur();
        if (label) label.textContent = "Copied";
        button.title = "Copied";
        window.setTimeout(() => {
            button.title = "Share filters";
            if (label) label.textContent = "Share filters";
        }, 1400);
    });
    source.after(button);
}
