import type { PreferenceRule } from "../../../domain/matching";

const TAG_CONTAINER_SELECTOR = '[data-testid="extra-domain-filters-listing-match-tags"]';
const NATIVE_TAG_SELECTOR = '[data-testid="listing-card-tag"]';

function getTagHost(card: Element): HTMLElement | undefined {
    const carousel = card.querySelector<HTMLElement>('[data-testid="listing-card-carousel"]');
    return carousel?.parentElement instanceof HTMLElement ? carousel.parentElement : undefined;
}

function createTag(template: HTMLElement | undefined, label: string): HTMLElement {
    const tag = template?.cloneNode(true) as HTMLElement | undefined ?? document.createElement("div");
    const text = tag.querySelector<HTMLElement>("span") ?? document.createElement("span");

    tag.classList.add("edf-preference-match-tag");
    tag.removeAttribute("role");
    tag.removeAttribute("tabindex");
    tag.setAttribute("data-testid", "extra-domain-filters-listing-match-tag");
    text.textContent = label;

    if (!text.isConnected) tag.append(text);
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

    const container = existing ?? document.createElement("div");
    const template = host.querySelector<HTMLElement>(NATIVE_TAG_SELECTOR) ?? undefined;

    container.className = "edf-preference-match-tags";
    container.setAttribute("data-testid", "extra-domain-filters-listing-match-tags");
    container.dataset.preferenceLabels = labels.join("|");
    container.replaceChildren(...labels.map(label => createTag(template, label)));

    if (!existing) host.append(container);
}
