import { markOwned } from "../../../dom/ownership";
import type { PreferenceRule } from "../../../domain/matching";

const TAG_CONTAINER_SELECTOR = '[data-testid="extra-domain-filters-listing-match-tags"]';

function getTagHost(card: Element): HTMLElement | undefined {
    const carousel = card.querySelector<HTMLElement>('[data-testid="listing-card-carousel"]');
    return carousel?.parentElement instanceof HTMLElement ? carousel.parentElement : undefined;
}

function createTag(label: string): HTMLElement {
    const tag = document.createElement("span");

    tag.className = "edf-preference-match-tag";
    tag.setAttribute("data-testid", "extra-domain-filters-listing-match-tag");
    tag.textContent = label;
    return tag;
}

export function updatePreferenceTags(card: Element, preferences: readonly PreferenceRule[]): void {
    const host = getTagHost(card);
    if (!host) return;

    const labels = preferences.map(preference => preference.label);
    const existing = host.querySelector<HTMLElement>(TAG_CONTAINER_SELECTOR);

    if (labels.length === 0) {
        existing?.remove();
        return;
    }

    if (existing?.dataset.preferenceLabels === labels.join("|")) return;

    const container = existing ?? markOwned(document.createElement("div"), "preference-match-tags");

    container.className = "edf-preference-match-tags";
    container.setAttribute("data-testid", "extra-domain-filters-listing-match-tags");
    container.dataset.preferenceLabels = labels.join("|");
    container.replaceChildren(...labels.map(createTag));

    if (!existing) host.append(container);
}
