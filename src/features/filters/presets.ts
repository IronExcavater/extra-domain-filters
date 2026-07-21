import type { PageContext } from "../../shared/platform/router";
import { getFilterPresets, type FilterPreset } from "../../shared/state/presets";
import { createSharedFilterUrl } from "./searchParams";

const PRESET_ATTRIBUTE = "data-extra-domain-filters-preset";
const RECENT_SEARCH_SELECTOR = '[data-testid="recent-search-item"]';

function createPresetCard(template: HTMLElement, preset: FilterPreset): HTMLElement {
    const card = template.cloneNode(true) as HTMLElement;
    const link = card.querySelector<HTMLAnchorElement>(RECENT_SEARCH_SELECTOR);
    const badge = card.querySelector('[data-testid="recent-search-badge"]');
    const title = card.querySelector(".css-d3a0h7");
    const description = card.querySelector('[data-testid="recent-search-description"]');
    const alert = card.querySelector('[data-testid="create-alert-frequency-button"]');

    card.setAttribute(PRESET_ATTRIBUTE, preset.id);
    badge?.remove();
    alert?.remove();
    if (link) link.href = createSharedFilterUrl({ filters: preset.filters }).href;
    if (title) title.textContent = preset.name;
    if (description) description.textContent = "Extra Domain Filters";
    return card;
}

async function injectPinnedPresets(): Promise<void> {
    const existing = document.querySelectorAll(`[${PRESET_ATTRIBUTE}]`);
    existing.forEach(element => element.remove());

    const source = document.querySelector<HTMLAnchorElement>(RECENT_SEARCH_SELECTOR);
    const template = source?.closest<HTMLElement>("article");
    const container = template?.parentElement;
    if (!template || !container) return;

    const pinned = (await getFilterPresets()).filter(preset => preset.pinned);
    container.append(...pinned.map(preset => createPresetCard(template, preset)));
}

export function bindFilterPresets(context: PageContext): void {
    let frame: number | undefined;
    const schedule = (): void => {
        if (frame !== undefined) return;
        frame = requestAnimationFrame(() => {
            frame = undefined;
            void injectPinnedPresets();
        });
    };
    const observer = new MutationObserver(mutations => {
        const addedRecentSearch = mutations.some(mutation =>
            [...mutation.addedNodes].some(node =>
                node instanceof HTMLElement &&
                !node.hasAttribute(PRESET_ATTRIBUTE) &&
                (node.matches(RECENT_SEARCH_SELECTOR) || Boolean(node.querySelector(RECENT_SEARCH_SELECTOR)))
            )
        );
        if (addedRecentSearch) schedule();
    });

    observer.observe(document.body, { childList: true, subtree: true });
    context.signal.addEventListener("abort", () => {
        observer.disconnect();
        if (frame !== undefined) cancelAnimationFrame(frame);
    }, { once: true });
    schedule();
}
