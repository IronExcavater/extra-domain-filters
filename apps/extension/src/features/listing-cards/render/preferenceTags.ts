import { markOwned } from "../../../dom/ownership";
import type { PreferenceRule } from "../../../domain/matching";

const DOMAIN_TAGS_SELECTOR = '[data-testid="listing-card-tag"]';
const OWN_TAGS_TEST_ID = "extra-domain-filters-listing-match-tags";
const TAG_TEST_ID = "extra-domain-filters-listing-match-tag";
const SPARKLE_PATH = "M8 1.5l1.4 3.6 3.6 1.4-3.6 1.4L8 11.5 6.6 7.9 3 6.5l3.6-1.4L8 1.5Z";

function getPhoto(card: Element): HTMLElement | undefined {
    return card.querySelector<HTMLElement>('[data-testid="listing-card-carousel"]') ?? undefined;
}

/**
 * Could-have matches join Domain's own tag row on the photo ("New", "Inspect Sat 10am"…), or
 * an identical row when the card has none, so they read as part of the card.
 */
function getTagRow(card: Element, create: boolean): HTMLElement | undefined {
    const photo = getPhoto(card);
    const hero = photo?.parentElement;
    if (!photo || !hero) return undefined;
    const domainRow = hero.querySelector<HTMLElement>(`:scope > ${DOMAIN_TAGS_SELECTOR}`);
    if (domainRow) return domainRow;

    const existing = hero.querySelector<HTMLElement>(`:scope > [data-testid="${OWN_TAGS_TEST_ID}"]`);
    if (existing || !create) return existing ?? undefined;
    const row = markOwned(document.createElement("div"), "preference-match-tags");
    row.className = "edf-preference-match-tags";
    row.dataset.testid = OWN_TAGS_TEST_ID;
    hero.append(row);
    return row;
}

function createTag(label: string): HTMLElement {
    const tag = markOwned(document.createElement("span"), "preference-match-tag");
    const icon = document.createElementNS("http://www.w3.org/2000/svg", "svg");
    const path = document.createElementNS("http://www.w3.org/2000/svg", "path");

    tag.className = "edf-preference-match-tag";
    tag.dataset.testid = TAG_TEST_ID;
    tag.title = `Matches your could-have: ${label}`;
    icon.classList.add("edf-preference-match-icon");
    icon.setAttribute("viewBox", "0 0 16 13");
    icon.setAttribute("aria-hidden", "true");
    path.setAttribute("d", SPARKLE_PATH);
    path.setAttribute("fill", "currentColor");
    icon.append(path);
    tag.append(icon, label);
    return tag;
}

export function updatePreferenceTags(card: Element, preferences: readonly PreferenceRule[]): void {
    const labels = preferences.map(preference => preference.label);
    const row = getTagRow(card, labels.length > 0);
    if (!row) return;

    const current = [...row.querySelectorAll<HTMLElement>(`[data-testid="${TAG_TEST_ID}"]`)];
    if (current.map(tag => tag.textContent).join("|") === labels.join("|")) return;

    current.forEach(tag => tag.remove());
    row.append(...labels.map(createTag));
    if (labels.length === 0 && row.dataset.testid === OWN_TAGS_TEST_ID) row.remove();
}
