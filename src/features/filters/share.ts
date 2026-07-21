import { getSettings } from "../../shared/state/settings";
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

    const button = source.cloneNode(true) as HTMLButtonElement;
    const label = [...button.querySelectorAll<HTMLElement>("span")].find(span => !span.querySelector("svg"));
    button.type = "button";
    button.name = "extra-domain-filters-share";
    button.dataset.testid = "extra-domain-filters-share";
    button.ariaLabel = "Copy filtered search link";
    if (label) label.textContent = "Share filters";
    button.addEventListener("click", async event => {
        event.preventDefault();
        syncSharedFilterParams(await getSettings());
        await copy(window.location.href);
        if (label) {
            label.textContent = "Copied";
            window.setTimeout(() => { label.textContent = "Share filters"; }, 1400);
        }
    });
    source.after(button);
}
