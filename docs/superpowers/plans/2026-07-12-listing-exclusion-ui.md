# Listing Exclusion UI Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the separate blacklist-summary and hard-hide-on-filter code paths with one
unified exclusion model (`blacklisted` | `filtered`), one shared collapsed-row UI component,
adjacency-based grouping of consecutive excluded listings, and correct per-card-shape handling
for standard cards, featured/topspot carousels, and projects.

**Architecture:** `matching/index.ts` computes a single `exclusionReason` per listing (still pure,
no DOM/storage access). `listing-cards/` renders that reason via a shared `exclusion-row.ts`
component, groups adjacent excluded top-level cards via `exclusion-group.ts`, and handles the two
"bundle" card shapes (project, featured carousel) via `bundle.ts` + `carousel.ts` + the updated
`project.ts`. A new `reveal.ts` tracks session-only "show anyway" overrides in memory.

**Tech Stack:** TypeScript, Vite + `@crxjs/vite-plugin`, vanilla DOM (no framework, no test
runner — this repo has none; see "Verification approach" below).

## Global Constraints

- No `chrome.storage` for filter-reveal state — session-only, in-memory (`Set<string>`), per the
  approved spec.
- Never detach/remove a DOM node that Domain's own React tree owns. Only ever hide it (inline
  `display: none !important` or an equivalent CSS toggle) or add new sibling nodes. This is not a
  style preference — an earlier bug in this codebase (`ads.ts` calling `.remove()` on live React
  nodes) corrupted React's fiber-to-DOM mapping and crashed the whole results page on the next
  re-render (pagination). Every task below that touches existing Domain DOM must follow this.
- `matchedPreferences` (could-have inclusion signal) is unchanged by this plan — it stays a
  separate field on `ListingMatch`, never merged into `exclusionReason`.
- Reuse `core/icons.ts`'s `setSvgIcon`/`replaceWithXIcon` pattern for every icon — never inline
  `innerHTML` SVG markup in a listing-cards module (existing project convention).
- Spec source of truth: `docs/superpowers/specs/2026-07-12-listing-exclusion-ui-design.md`.

## Verification approach

This repo has no test runner (removed deliberately in an earlier session for "a lighter,
fresh-start extension" — see `git log`). The established verification loop, used consistently
throughout this project, is:

1. `npx tsc --noEmit` — type-check.
2. `npx eslint <changed files>` — lint.
3. `npx stylelint src/app/main.css` — for any CSS task.
4. `npx vite build` — confirms the CRX plugin bundles everything (catches asset-import mistakes
   `tsc`/`eslint` can't see, e.g. a bad `?raw` import path).

For pure logic (no DOM) — `matching/index.ts`, `reveal.ts`, the adjacency-grouping algorithm in
`exclusion-group.ts` — each task also includes a throwaway Node verification script (run via
`node`, not committed) that exercises the real exported function with representative inputs and
asserts the expected output, standing in for a unit test. This mirrors how this session already
verified other pure-logic bugs earlier (e.g. the listing-route regex).

For DOM-heavy tasks, live verification against the real site (Chrome DevTools MCP / Playwright
MCP tools) is called out explicitly where the code's correctness genuinely depends on Domain's
current markup or on slick-carousel's runtime behavior, which can't be verified through
`tsc`/`eslint`/`build` alone. Note: as of this plan being written, `domain.com.au` was
rate-limiting automated requests ("Access Denied") — if that's still the case when a task's live
check runs, wait and retry rather than skipping the check; don't guess.

---

### Task 1: Unify the matching model (`matching/index.ts`) and fix the property-type gap

**Files:**
- Modify: `src/matching/index.ts`
- Modify: `src/pages/listing.ts:16-26,61-63`

**Interfaces:**
- Consumes: existing `isBlacklisted`, `BlacklistEntry`, `Settings` (unchanged).
- Produces: `export type ExclusionReason = "none" | "blacklisted" | "filtered"`; `ListingMatch`
  becomes `{ exclusionReason: ExclusionReason; matchedPreferences: PreferenceRule[] }` (replacing
  `excluded: boolean; blacklisted: boolean`). `ListingSnapshot` gains `propertyType?: string`.
  Every later task that reads `match.excluded`/`match.blacklisted` must be updated to read
  `match.exclusionReason` instead — there are two call sites outside this task, both listed here.

While auditing this file: `Settings.filters.excludePropertyKeywords` is stored (checkboxes in
`filters/index.ts` write to it) but **`matchListing` never actually checks it** — property-type
exclusion has silently never worked. This task fixes that gap as part of generalizing the model,
since the spec says "filtered" should cover "any listing currently hidden by filters... exclude
keywords, strata-fee max, and excluded property types."

- [ ] **Step 1: Write a throwaway verification script for the new `matchListing` behavior**

Create `/tmp/verify-matching.mjs` (not committed — delete after Step 4):

```js
// Mirrors matching/index.ts's pure logic to verify behavior before/after the TS edit.
function includesAny(text, keywords) {
    const normalizedText = text.toLowerCase();
    return keywords.some(k => {
        const nk = k.trim().toLowerCase();
        return nk !== "" && normalizedText.includes(nk);
    });
}

function matchesExcludedPropertyType(propertyType, excludePropertyKeywords) {
    if (!propertyType || excludePropertyKeywords.length === 0) return false;
    return excludePropertyKeywords.includes(propertyType.trim().toLowerCase());
}

function computeReason({ isBlacklisted, text, propertyType }, filters) {
    if (isBlacklisted) return "blacklisted";
    if (
        includesAny(text, filters.excludeKeywords) ||
        matchesExcludedPropertyType(propertyType, filters.excludePropertyKeywords)
    ) return "filtered";
    return "none";
}

const assert = (actual, expected, label) => {
    if (actual !== expected) throw new Error(`FAIL ${label}: got ${actual}, want ${expected}`);
    console.log(`PASS ${label}`);
};

assert(computeReason({ isBlacklisted: true, text: "nice house", propertyType: "house" }, { excludeKeywords: [], excludePropertyKeywords: [] }), "blacklisted", "blacklist wins over everything");
assert(computeReason({ isBlacklisted: false, text: "granny flat included", propertyType: "house" }, { excludeKeywords: ["granny flat"], excludePropertyKeywords: [] }), "filtered", "keyword exclusion");
assert(computeReason({ isBlacklisted: false, text: "lovely apartment", propertyType: "apartment" }, { excludeKeywords: [], excludePropertyKeywords: ["apartment"] }), "filtered", "property-type exclusion (previously never checked)");
assert(computeReason({ isBlacklisted: false, text: "lovely townhouse", propertyType: "townhouse" }, { excludeKeywords: [], excludePropertyKeywords: ["house"] }), "none", "property-type exclusion is exact-match, not substring (townhouse != house)");
assert(computeReason({ isBlacklisted: false, text: "plain listing", propertyType: "house" }, { excludeKeywords: [], excludePropertyKeywords: [] }), "none", "nothing excluded");
```

- [ ] **Step 2: Run it to confirm the intended behavior before touching the real file**

Run: `node /tmp/verify-matching.mjs`
Expected: five `PASS` lines, no `FAIL`, no thrown error.

- [ ] **Step 3: Edit `src/matching/index.ts`**

Replace the `ListingSnapshot` interface:

```ts
export interface ListingSnapshot {
    url: string;
    title: string;
    text: string;
    displayAddress?: string;
    features?: {
        bathrooms?: string;
        bedrooms?: string;
        parking?: string;
    };
    price?: string;
    status?: string;
    thumbnailUrl?: string;
    propertyType?: string;
}
```

Replace the `ListingMatch` interface:

```ts
export type ExclusionReason = "none" | "blacklisted" | "filtered";

export interface ListingMatch {
    exclusionReason: ExclusionReason;
    matchedPreferences: PreferenceRule[];
}
```

Add, right after `exceedsStrataMax`:

```ts
function matchesExcludedPropertyType(
    propertyType: string | undefined,
    excludePropertyKeywords: readonly string[],
): boolean {
    if (!propertyType || excludePropertyKeywords.length === 0) return false;

    return excludePropertyKeywords.includes(propertyType.trim().toLowerCase());
}
```

Replace `matchListing`:

```ts
export function matchListing(
    listing: ListingSnapshot,
    settings: Settings,
    blacklist: readonly BlacklistEntry[],
): ListingMatch {
    const text = `${listing.title}\n${listing.text}`;
    const filters = settings.filters;

    const exclusionReason: ExclusionReason = isBlacklisted(blacklist, listing.url)
        ? "blacklisted"
        : includesAny(text, filters.excludeKeywords) ||
            exceedsStrataMax(text, filters.strataMaxDollars) ||
            matchesExcludedPropertyType(listing.propertyType, filters.excludePropertyKeywords)
            ? "filtered"
            : "none";

    const matchedPreferences = PREFERENCES.filter(
        preference =>
            filters.couldHaveRuleIds.includes(preference.id) &&
            preference.pattern.test(text),
    );

    return {
        exclusionReason,
        matchedPreferences,
    };
}
```

- [ ] **Step 4: Delete the throwaway script**

Run: `rm /tmp/verify-matching.mjs` (or `Remove-Item` on Windows PowerShell)

- [ ] **Step 5: Fix the two out-of-module callers**

`src/pages/listing.ts` uses `.blacklisted` in two places. Edit `updateButton` (lines 16-26):

```ts
async function updateButton(button: HTMLButtonElement, url: string): Promise<void> {
    const blacklist = (await getFromStorage<BlacklistEntry[]>("blacklist")) ?? [];
    const active = matchListing(
        { url, title: "", text: "" },
        await getSettings(),
        blacklist
    ).exclusionReason === "blacklisted";

    button.textContent = active ? "Remove from blacklist" : "Blacklist";
    button.dataset.active = String(active);
}
```

And the click handler (line 61):

```ts
        const next = matchListing(listing, await getSettings(), blacklist).exclusionReason === "blacklisted"
            ? removeBlacklistEntry(blacklist, url)
            : addBlacklistEntry(blacklist, listing);
```

Note: `src/listing-cards/index.ts` also reads `match.excluded`/`match.blacklisted` — that file is
substantially rewritten in Task 10, so it's left alone (and will not compile) until then. This is
expected and fine for a multi-task plan; don't attempt to fix it now.

- [ ] **Step 6: Type-check `pages/listing.ts` and `matching/index.ts` in isolation**

Run: `npx tsc --noEmit`
Expected: errors only in `src/listing-cards/index.ts` (reads the old `ListingMatch` shape — fixed
in Task 10). No errors in `matching/index.ts` or `pages/listing.ts`.

- [ ] **Step 7: Lint the changed files**

Run: `npx eslint src/matching/index.ts src/pages/listing.ts`
Expected: no output (clean).

- [ ] **Step 8: Commit**

```bash
git add src/matching/index.ts src/pages/listing.ts
git commit -m "Unify blacklist/filter exclusion into one ExclusionReason, fix property-type exclusion gap"
```

---

### Task 2: Fix `eye`/`eye-off` icon color inheritance and add the chevron icon

**Files:**
- Modify: `public/eye.svg`
- Modify: `public/eye-off.svg`
- Create: `public/chevron.svg`
- Modify: `src/core/icons.ts`

**Interfaces:**
- Consumes: nothing new.
- Produces: `replaceWithEyeIcon(target: SVGElement): void`, `replaceWithEyeOffIcon(target: SVGElement): void`, `replaceWithChevronIcon(target: SVGElement): void` — used by Task 4 (exclusion-row) and Task 6 (exclusion-group).

`public/eye.svg` and `public/eye-off.svg` already exist but their visible `<path>` has no `fill`
attribute, so it defaults to SVG's `fill: black` — unlike every other icon in this codebase
(`bin.svg`, `shortlist.svg`, etc.), which use `fill="currentColor"` so the icon inherits the
button's `color` (this is how the blacklist button's default/hover/active color rules work).
Without this fix, the eye icons would render solid black regardless of button state.

- [ ] **Step 1: Fix `public/eye.svg`**

```html
<?xml version="1.0" encoding="utf-8"?>
<!-- Uploaded to: SVG Repo, www.svgrepo.com, Generator: SVG Repo Mixer Tools -->
<svg width="800px" height="800px" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
    <g>
        <path fill="none" d="M0 0h24v24H0z"/>
        <path fill="currentColor" d="M12 3c5.392 0 9.878 3.88 10.819 9-.94 5.12-5.427 9-10.819 9-5.392 0-9.878-3.88-10.819-9C2.121 6.88 6.608 3 12 3zm0 16a9.005 9.005 0 0 0 8.777-7 9.005 9.005 0 0 0-17.554 0A9.005 9.005 0 0 0 12 19zm0-2.5a4.5 4.5 0 1 1 0-9 4.5 4.5 0 0 1 0 9zm0-2a2.5 2.5 0 1 0 0-5 2.5 2.5 0 0 0 0 5z"/>
    </g>
</svg>
```

- [ ] **Step 2: Fix `public/eye-off.svg`**

```html
<?xml version="1.0" encoding="utf-8"?>
<!-- Uploaded to: SVG Repo, www.svgrepo.com, Generator: SVG Repo Mixer Tools -->
<svg width="800px" height="800px" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
    <g>
        <path fill="none" d="M0 0h24v24H0z"/>
        <path fill="currentColor" d="M17.882 19.297A10.949 10.949 0 0 1 12 21c-5.392 0-9.878-3.88-10.819-9a10.982 10.982 0 0 1 3.34-6.066L1.392 2.808l1.415-1.415 19.799 19.8-1.415 1.414-3.31-3.31zM5.935 7.35A8.965 8.965 0 0 0 3.223 12a9.005 9.005 0 0 0 13.201 5.838l-2.028-2.028A4.5 4.5 0 0 1 8.19 9.604L5.935 7.35zm6.979 6.978l-3.242-3.242a2.5 2.5 0 0 0 3.241 3.241zm7.893 2.264l-1.431-1.43A8.935 8.935 0 0 0 20.777 12 9.005 9.005 0 0 0 9.552 5.338L7.974 3.76C9.221 3.27 10.58 3 12 3c5.392 0 9.878 3.88 10.819 9a10.947 10.947 0 0 1-2.012 4.592zm-9.084-9.084a4.5 4.5 0 0 1 4.769 4.769l-4.77-4.769z"/>
    </g>
</svg>
```

- [ ] **Step 3: Create `public/chevron.svg`**

A simple right-pointing chevron, rotated via CSS when expanded (see Task 6's CSS) rather than
needing a second asset:

```html
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24">
    <path fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" d="M9 6l6 6-6 6"/>
</svg>
```

- [ ] **Step 4: Wire all three into `src/core/icons.ts`**

Add imports at the top (alphabetical, matching existing style):

```ts
import bathSvg from "../../public/bath.svg?raw";
import bedSvg from "../../public/bed.svg?raw";
import binSvg from "../../public/bin.svg?raw";
import chevronSvg from "../../public/chevron.svg?raw";
import eyeOffSvg from "../../public/eye-off.svg?raw";
import eyeSvg from "../../public/eye.svg?raw";
import parkingSvg from "../../public/parking.svg?raw";
import shortlistSvg from "../../public/shortlist.svg?raw";
import unbinSvg from "../../public/unbin.svg?raw";
```

Add at the end of the file:

```ts
export function replaceWithEyeIcon(target: SVGElement): void {
    setSvgIcon(target, eyeSvg);
}

export function replaceWithEyeOffIcon(target: SVGElement): void {
    setSvgIcon(target, eyeOffSvg);
}

export function replaceWithChevronIcon(target: SVGElement): void {
    setSvgIcon(target, chevronSvg);
}
```

- [ ] **Step 5: Type-check, lint, build**

Run: `npx tsc --noEmit && npx eslint src/core/icons.ts && npx vite build`
Expected: no errors; build output lists the three new SVGs are inlined (no separate asset files
for them, since `?raw` imports become string literals in the JS bundle — confirm no new
`dist/public/*.svg` entries appear, matching how `bin.svg`/`bed.svg` etc. already behave).

- [ ] **Step 6: Commit**

```bash
git add public/eye.svg public/eye-off.svg public/chevron.svg src/core/icons.ts
git commit -m "Fix eye/eye-off icon color inheritance, add chevron icon"
```

---

### Task 3: Session-only filter-reveal tracking (`listing-cards/reveal.ts`)

**Files:**
- Create: `src/listing-cards/reveal.ts`

**Interfaces:**
- Consumes: nothing (no dependencies on other listing-cards modules).
- Produces: `isRevealed(url: string): boolean`, `reveal(url: string): void`, `unreveal(url: string): void`.
  Consumed by Task 10 (index.ts, to suppress `"filtered"` when revealed) and Task 4
  (exclusion-row.ts, for the action button and the eye-off affordance).

- [ ] **Step 1: Write a throwaway verification script**

Create `/tmp/verify-reveal.mjs` (not committed):

```js
const revealed = new Set();
const normalize = url => url.replace(/\/+$/, "");
const isRevealed = url => revealed.has(normalize(url));
const reveal = url => revealed.add(normalize(url));
const unreveal = url => revealed.delete(normalize(url));

const assert = (actual, expected, label) => {
    if (actual !== expected) throw new Error(`FAIL ${label}: got ${actual}, want ${expected}`);
    console.log(`PASS ${label}`);
};

assert(isRevealed("https://x/a"), false, "not revealed initially");
reveal("https://x/a/");
assert(isRevealed("https://x/a"), true, "revealed (trailing slash normalized)");
unreveal("https://x/a");
assert(isRevealed("https://x/a/"), false, "unrevealed again");
```

- [ ] **Step 2: Run it**

Run: `node /tmp/verify-reveal.mjs`
Expected: three `PASS` lines.

- [ ] **Step 3: Write `src/listing-cards/reveal.ts`**

```ts
// Session-only: a plain in-memory set, never written to chrome.storage. Reloading the page or
// revisiting the search later loses every override and filtered listings go back to being
// filtered — this is intentional (see design spec's "Session-only reveal tracking" section).
const revealedUrls = new Set<string>();

function normalize(url: string): string {
    return url.replace(/\/+$/, "");
}

export function isRevealed(url: string): boolean {
    return revealedUrls.has(normalize(url));
}

export function reveal(url: string): void {
    revealedUrls.add(normalize(url));
}

export function unreveal(url: string): void {
    revealedUrls.delete(normalize(url));
}
```

- [ ] **Step 4: Delete the throwaway script**

Run: `rm /tmp/verify-reveal.mjs`

- [ ] **Step 5: Type-check and lint**

Run: `npx tsc --noEmit && npx eslint src/listing-cards/reveal.ts`
Expected: no new errors introduced by this file (the pre-existing `listing-cards/index.ts` error
from Task 1 is still expected here).

- [ ] **Step 6: Commit**

```bash
git add src/listing-cards/reveal.ts
git commit -m "Add session-only filter-reveal tracking"
```

---

### Task 4: Shared collapsed-row component (`listing-cards/exclusion-row.ts`)

**Files:**
- Delete: `src/listing-cards/summary.ts`
- Create: `src/listing-cards/exclusion-row.ts`
- Modify: `src/app/main.css`

**Interfaces:**
- Consumes: `ExclusionReason` (Task 1), `isRevealed`/`reveal`/`unreveal` (Task 3),
  `getBlacklistCardKind`/`getPropertyCount`/`getTitle` (existing `card.ts`),
  `removeBlacklistEntry`/`isBlacklisted` (existing `matching`), `getFromStorage`/`setInStorage`
  (existing `core/storage`), `replaceWithBinIcon`/`replaceWithEyeIcon`/`replaceWithEyeOffIcon`
  (Task 2).
- Produces: `getExclusionRow(card, kind): HTMLElement`, `updateExclusionRow(card, url, reason): void`,
  `applyExclusionState(card, kind, reason): void`, `resolveExclusionAction(url, reason): Promise<void>`,
  `getExclusionSummaryText(card, reason): string`. Consumed by Task 6 (exclusion-group.ts, reuses
  `resolveExclusionAction` and the text/icon logic for compact per-listing lines), Task 9
  (project.ts), Task 10 (index.ts).

This replaces `summary.ts`'s `getSummary`/`applyBlacklistCardState`/`updateBlacklistSummaryText`,
generalized to both exclusion reasons, plus the new "eye-off, hide again" affordance placed on
the real (expanded) card content per the spec.

- [ ] **Step 1: Delete the old module**

Run: `rm src/listing-cards/summary.ts`

- [ ] **Step 2: Write `src/listing-cards/exclusion-row.ts`**

```ts
import { getFromStorage, setInStorage } from "../core/storage";
import {
    replaceWithBinIcon,
    replaceWithEyeIcon,
    replaceWithEyeOffIcon,
} from "../core/icons";
import {
    removeBlacklistEntry,
    type BlacklistEntry,
    type ExclusionReason,
} from "../matching";
import { isRevealed, reveal, unreveal } from "./reveal";
import { getBlacklistCardKind, getPropertyCount, getTitle, type BlacklistCardKind } from "./card";

const ROW_SELECTOR = '[data-testid="listing-card-exclusion-row"]';
const KIND_CLASSES = [
    "edf-exclusion-kind-standard",
    "edf-exclusion-kind-carousel-child",
    "edf-exclusion-kind-project",
    "edf-exclusion-kind-project-child",
];

// Only ever called with "blacklisted" or "filtered" — "none" never reaches a row (the card is
// shown normally instead).
type ActiveReason = Exclude<ExclusionReason, "none">;

export function getExclusionSummaryText(card: Element, reason: ActiveReason): string {
    const count = getPropertyCount(card);
    const title = getTitle(card);

    if (reason === "blacklisted") {
        return count > 1 ? `${count} properties blacklisted` : `Blacklisted: ${title}`;
    }

    return count > 1 ? `${count} properties filtered out` : `Filtered out: ${title}`;
}

// Only ever called to undo an existing exclusion (the row/group action button only appears on
// already-excluded listings) — never to add a new one, so it needs no ListingSnapshot.
export async function resolveExclusionAction(url: string, reason: ActiveReason): Promise<void> {
    if (reason === "filtered") {
        reveal(url);
        return;
    }

    const current = (await getFromStorage<BlacklistEntry[]>("blacklist")) ?? [];
    await setInStorage("blacklist", removeBlacklistEntry(current, url));
}

export function getExclusionRow(card: Element): HTMLElement {
    const existing = card.querySelector<HTMLElement>(ROW_SELECTOR);
    if (existing) return existing;

    const row = document.createElement("div");
    const text = document.createElement("span");
    const button = document.createElement("button");
    const icon = document.createElementNS("http://www.w3.org/2000/svg", "svg");

    row.className = "edf-exclusion-row";
    row.setAttribute("data-testid", "listing-card-exclusion-row");

    text.className = "edf-exclusion-row-text";
    text.setAttribute("data-testid", "listing-card-exclusion-row-text");

    icon.setAttribute("aria-hidden", "true");
    icon.setAttribute("width", "18");
    icon.setAttribute("height", "18");

    button.type = "button";
    button.className = "edf-exclusion-row-button";
    button.setAttribute("data-testid", "listing-card-exclusion-restore");
    button.append(icon, "");

    row.append(text, button);
    card.prepend(row);

    return row;
}

export function updateExclusionRow(card: Element, url: string, reason: ActiveReason): void {
    const row = getExclusionRow(card);
    const text = row.querySelector<HTMLElement>('[data-testid="listing-card-exclusion-row-text"]');
    const button = row.querySelector<HTMLButtonElement>('[data-testid="listing-card-exclusion-restore"]');
    const icon = button?.querySelector("svg");

    if (text) text.textContent = getExclusionSummaryText(card, reason);

    if (icon) (reason === "blacklisted" ? replaceWithBinIcon : replaceWithEyeIcon)(icon);

    if (button) {
        const label = reason === "blacklisted" ? "Unblacklist" : "Show anyway";
        button.lastChild!.textContent = label;
        button.ariaLabel = label;
        button.onclick = async event => {
            event.preventDefault();
            event.stopPropagation();
            await resolveExclusionAction(url, reason);
        };
    }
}

export function applyExclusionState(
    card: Element,
    button: HTMLButtonElement,
    reason: ExclusionReason,
): void {
    const kind: BlacklistCardKind = getBlacklistCardKind(card, button);

    card.classList.remove(...KIND_CLASSES);
    card.classList.add(`edf-exclusion-kind-${kind}`);
    card.classList.toggle("edf-listing-card-excluded", reason !== "none");
    (card as HTMLElement).dataset.exclusionReason = reason;
}

// Placed on the real, expanded card content for a "filtered" listing that's currently revealed,
// so the user can re-hide it without waiting for filters to change. Idempotent — safe to call on
// every refresh.
const EYE_OFF_SELECTOR = '[data-testid="listing-card-hide-again"]';

export function ensureHideAgainAffordance(card: Element, url: string): void {
    if (card.querySelector(EYE_OFF_SELECTOR)) return;

    const button = document.createElement("button");
    const icon = document.createElementNS("http://www.w3.org/2000/svg", "svg");

    button.type = "button";
    button.className = "edf-hide-again-button";
    button.setAttribute("data-testid", "listing-card-hide-again");
    button.ariaLabel = "Hide this listing again";
    button.title = "Hide this listing again";

    icon.setAttribute("aria-hidden", "true");
    icon.setAttribute("width", "16");
    icon.setAttribute("height", "16");
    replaceWithEyeOffIcon(icon);

    button.append(icon);
    button.addEventListener("click", event => {
        event.preventDefault();
        event.stopPropagation();
        unreveal(url);
    });

    card.appendChild(button);
}

export function removeHideAgainAffordance(card: Element): void {
    card.querySelector(EYE_OFF_SELECTOR)?.remove();
}

export { isRevealed };
```

- [ ] **Step 3: Update `src/app/main.css`** — rename/generalize the blacklist-specific rules and
  add the eye-off affordance styling

Find and replace this block (the old blacklist-summary rules):

```css
.edf-blacklist-summary {
    align-items: center;
    background: #f2f4f7;
    border: 1px solid #d0d5dd;
    border-radius: 4px;
    color: #475467;
    display: none;
    gap: 12px;
    font-weight: 500;
    justify-content: space-between;
    line-height: 1.3;
    min-height: 34px;
    padding: 6px 10px;
}

.edf-blacklist-summary-text {
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
}

.edf-blacklist-summary-button {
    align-items: center;
    background: transparent;
    border: 0;
    color: #344054;
    cursor: pointer;
    display: inline-flex;
    flex: 0 0 auto;
    gap: 6px;
    font: inherit;
    font-weight: 600;
    padding: 0;
}

.edf-listing-card-blacklisted {
    background: #f7f8fa !important;
    max-height: 48px !important;
    min-height: 38px !important;
    overflow: hidden !important;
    transition:
        background-color 180ms ease,
        max-height 180ms ease,
        min-height 180ms ease;
}

.edf-listing-card-blacklisted > :not(.edf-blacklist-summary) {
    display: none !important;
}

.edf-listing-card-blacklisted > .edf-blacklist-summary {
    display: flex !important;
}

.edf-listing-card-blacklisted.edf-blacklist-kind-carousel-child {
    max-height: 38px !important;
    min-height: 34px !important;
}
```

with:

```css
.edf-exclusion-row {
    align-items: center;
    background: #f2f4f7;
    border: 1px solid #d0d5dd;
    border-radius: 4px;
    color: #475467;
    display: none;
    gap: 12px;
    font-weight: 500;
    justify-content: space-between;
    line-height: 1.3;
    min-height: 34px;
    padding: 6px 10px;
}

.edf-exclusion-row-text {
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
}

.edf-exclusion-row-button {
    align-items: center;
    background: transparent;
    border: 0;
    color: #344054;
    cursor: pointer;
    display: inline-flex;
    flex: 0 0 auto;
    gap: 6px;
    font: inherit;
    font-weight: 600;
    padding: 0;
}

/* Animated collapse: a small max-height + overflow:hidden when excluded, transitioning smoothly
   to/from the large max-height applied when the reason clears back to "none" (see the
   :not([data-exclusion-reason]) escape hatch below) — no JS-measured heights needed. */
.edf-listing-card-excluded {
    background: #f7f8fa !important;
    max-height: 48px !important;
    min-height: 38px !important;
    overflow: hidden !important;
    transition:
        background-color 180ms ease,
        max-height 180ms ease,
        min-height 180ms ease;
}

.edf-listing-card-excluded > :not(.edf-exclusion-row) {
    display: none !important;
}

.edf-listing-card-excluded > .edf-exclusion-row {
    display: flex !important;
}

.edf-listing-card-excluded.edf-exclusion-kind-carousel-child {
    max-height: 38px !important;
    min-height: 34px !important;
}
```

Then find `.edf-blacklist-kind-` in the class-removal lists elsewhere in this file (there are
none left after this edit — `exclusion-row.ts`'s `KIND_CLASSES` already uses the new
`edf-exclusion-kind-*` names) and the `.edf-project-blacklist-summary` rule's comment referencing
"blacklisted" generically — leave that rule as-is structurally (Task 9 still uses it), just note
it now also applies when project children are filtered, not just blacklisted.

Finally, add the eye-off affordance styling (append to the file):

```css
.edf-hide-again-button {
    align-items: center;
    background: rgb(255 255 255 / 90%);
    border: 1px solid rgb(30 41 61 / 15%);
    border-radius: 999px;
    color: rgb(30 41 61 / 70%);
    cursor: pointer;
    display: inline-flex;
    padding: 4px;
}

.edf-hide-again-button:hover {
    background: #fff;
    color: rgb(30 41 61 / 100%);
}
```

- [ ] **Step 4: Type-check and lint**

Run: `npx tsc --noEmit`
Expected: errors remain in `src/listing-cards/index.ts` (fixed in Task 10) and
`src/listing-cards/project.ts` (still imports the deleted `getSummary` from `./summary` — fixed
in Task 9). No errors in `exclusion-row.ts` itself.

Run: `npx eslint src/listing-cards/exclusion-row.ts`
Expected: no output.

- [ ] **Step 5: Lint the CSS**

Run: `npx stylelint src/app/main.css`
Expected: no output (fix any reported issues before continuing — this file has needed
`--fix`-then-reformat passes before in this project's history for color-notation rules).

- [ ] **Step 6: Commit**

```bash
git add src/listing-cards/exclusion-row.ts src/app/main.css
git rm src/listing-cards/summary.ts
git commit -m "Replace blacklist-only summary component with generalized exclusion-row"
```

---

### Task 5: Adjacency grouping (`listing-cards/exclusion-group.ts`)

**Files:**
- Create: `src/listing-cards/exclusion-group.ts`
- Modify: `src/app/main.css`
- Modify: `src/listing-cards/card.ts:10-15` (export a top-level-only selector)

**Interfaces:**
- Consumes: `getTitle` (`card.ts`), `resolveExclusionAction` (Task 4), `replaceWithBinIcon`/`replaceWithEyeIcon`/`replaceWithChevronIcon` (Task 2).
- Produces: `updateExclusionGroups(): void`. Consumed by Task 10 (index.ts, called once per
  `updateExistingCards` pass, after every individual card's `data-exclusionReason` has been set).

This is the new three-level disclosure from the spec: group row → hover-expand to a per-listing
compact list → per-listing chevron reveals that one listing's summary + action button.

**Safety note carried over from the Global Constraints section**: this module only ever *hides*
excluded top-level cards via an inline `!important` style (same technique already proven safe in
`ads.ts`) and *adds* a new sibling group element — it never removes or moves a card Domain's React
owns. Every run fully resets (un-hides everything, deletes old group elements) before recomputing,
so there's no stale-state bug to reason about across re-runs.

- [ ] **Step 1: Export a top-level-card selector from `card.ts`**

In `src/listing-cards/card.ts`, the existing `CARD_SELECTOR` constant (used by `getCard`) includes
`'[data-testid="listing-card-child-listing"]'`, which is a *nested* card, not a top-level one.
Add a new, exported, top-level-only selector right after the existing `CARD_SELECTOR` definition:

```ts
export const TOP_LEVEL_CARD_SELECTOR = [
    LISTING_CARD_CONTAINER_SELECTOR,
    'li[data-testid="topspot"]',
    'li[data-testid^="listing-"]',
].join(',');
```

(Deliberately excludes `'[data-testid="listing-card-child-listing"]'` — that's the one difference
from `CARD_SELECTOR` just above it in the file.)

- [ ] **Step 2: Write `src/listing-cards/exclusion-group.ts`**

```ts
import { replaceWithBinIcon, replaceWithChevronIcon, replaceWithEyeIcon } from "../core/icons";
import { getListingUrl, getTitle, TOP_LEVEL_CARD_SELECTOR } from "./card";
import { resolveExclusionAction } from "./exclusion-row";

const GROUP_SELECTOR = '[data-testid="extra-domain-filters-exclusion-group"]';
const GROUP_MEMBER_HIDDEN_STYLE_PROP = "display";

type ActiveReason = "blacklisted" | "filtered";

interface GroupMember {
    card: HTMLElement;
    url: string;
    reason: ActiveReason;
}

function findTopLevelCards(): HTMLElement[] {
    return [...document.querySelectorAll<HTMLElement>(TOP_LEVEL_CARD_SELECTOR)];
}

function getActiveReason(card: HTMLElement): ActiveReason | undefined {
    const reason = card.dataset.exclusionReason;
    return reason === "blacklisted" || reason === "filtered" ? reason : undefined;
}

function getMemberUrl(card: HTMLElement): string | undefined {
    // The group only ever reads cards that already went through updateExistingCards, so a
    // blacklist button (whose data-testid this selector matches) is always present.
    const button = card.querySelector<HTMLButtonElement>('[data-testid="listing-card-blacklist"]');
    if (!button) return undefined;

    return getListingUrl(button, card);
}

function createMemberRow(member: GroupMember): HTMLElement {
    const row = document.createElement("div");
    row.className = "edf-exclusion-group-member";

    const icon = document.createElementNS("http://www.w3.org/2000/svg", "svg");
    icon.setAttribute("aria-hidden", "true");
    icon.setAttribute("width", "16");
    icon.setAttribute("height", "16");
    (member.reason === "blacklisted" ? replaceWithBinIcon : replaceWithEyeIcon)(icon);

    const address = document.createElement("span");
    address.className = "edf-exclusion-group-member-address";
    address.textContent = getTitle(member.card);

    const chevron = document.createElement("button");
    chevron.type = "button";
    chevron.className = "edf-exclusion-group-chevron";
    chevron.setAttribute("aria-expanded", "false");
    chevron.ariaLabel = "Show options";
    const chevronIcon = document.createElementNS("http://www.w3.org/2000/svg", "svg");
    chevronIcon.setAttribute("aria-hidden", "true");
    chevronIcon.setAttribute("width", "16");
    chevronIcon.setAttribute("height", "16");
    replaceWithChevronIcon(chevronIcon);
    chevron.append(chevronIcon);

    const detail = document.createElement("div");
    detail.className = "edf-exclusion-group-detail";
    detail.hidden = true;

    const actionButton = document.createElement("button");
    actionButton.type = "button";
    actionButton.className = "edf-exclusion-row-button";
    actionButton.textContent = member.reason === "blacklisted" ? "Unblacklist" : "Show anyway";
    actionButton.addEventListener("click", async event => {
        event.preventDefault();
        event.stopPropagation();
        await resolveExclusionAction(member.url, member.reason);
    });
    detail.append(actionButton);

    chevron.addEventListener("click", event => {
        event.preventDefault();
        event.stopPropagation();
        const expanded = chevron.getAttribute("aria-expanded") === "true";
        chevron.setAttribute("aria-expanded", String(!expanded));
        detail.hidden = expanded;
    });

    row.append(icon, address, chevron, detail);
    return row;
}

function createGroupElement(run: GroupMember[]): HTMLElement {
    const group = document.createElement("div");
    group.className = "edf-exclusion-group";
    group.setAttribute("data-testid", "extra-domain-filters-exclusion-group");

    const summary = document.createElement("div");
    summary.className = "edf-exclusion-row edf-exclusion-group-summary";
    summary.tabIndex = 0;
    const label = document.createElement("span");
    label.className = "edf-exclusion-row-text";
    label.textContent = `${run.length} listings hidden`;
    summary.append(label);

    const list = document.createElement("div");
    list.className = "edf-exclusion-group-list";
    for (const member of run) list.append(createMemberRow(member));

    group.append(summary, list);

    let closeTimer: ReturnType<typeof window.setTimeout> | undefined;
    const expand = (): void => {
        if (closeTimer !== undefined) {
            window.clearTimeout(closeTimer);
            closeTimer = undefined;
        }
        group.classList.add("edf-exclusion-group-expanded");
    };
    const collapse = (): void => {
        closeTimer = window.setTimeout(() => {
            group.classList.remove("edf-exclusion-group-expanded");
            closeTimer = undefined;
        }, 250);
    };

    group.addEventListener("mouseenter", expand);
    group.addEventListener("mouseleave", collapse);
    group.addEventListener("focusin", expand);
    group.addEventListener("focusout", collapse);

    return group;
}

// Fully idempotent: removes every group element and un-hides every previously-grouped card
// before recomputing from scratch. Search-result pages are small (~20 cards), so a full
// recompute on every call is cheap and far simpler to reason about than diffing groups across
// calls.
export function updateExclusionGroups(): void {
    document.querySelectorAll(GROUP_SELECTOR).forEach(element => element.remove());

    const cards = findTopLevelCards();
    for (const card of cards) {
        card.style.removeProperty(GROUP_MEMBER_HIDDEN_STYLE_PROP);
    }

    let index = 0;
    while (index < cards.length) {
        const reason = getActiveReason(cards[index]);
        if (!reason) {
            index += 1;
            continue;
        }

        let end = index + 1;
        while (end < cards.length && getActiveReason(cards[end]) !== undefined) {
            end += 1;
        }

        const run = cards.slice(index, end);
        if (run.length >= 2) {
            const members = run
                .map((card): GroupMember | undefined => {
                    const memberReason = getActiveReason(card);
                    const url = getMemberUrl(card);
                    return memberReason && url ? { card, url, reason: memberReason } : undefined;
                })
                .filter((member): member is GroupMember => member !== undefined);

            if (members.length >= 2) {
                const group = createGroupElement(members);
                run[0].before(group);
                for (const member of members) {
                    member.card.style.setProperty(GROUP_MEMBER_HIDDEN_STYLE_PROP, "none", "important");
                }
            }
        }

        index = end;
    }
}
```

- [ ] **Step 3: Add CSS for the group component**

Append to `src/app/main.css`:

```css
.edf-exclusion-group-summary {
    cursor: pointer;
}

.edf-exclusion-group-list {
    display: none;
    flex-direction: column;
    gap: 6px;
    margin-top: 6px;
}

.edf-exclusion-group-expanded .edf-exclusion-group-summary {
    display: none;
}

.edf-exclusion-group-expanded .edf-exclusion-group-list {
    display: flex;
}

.edf-exclusion-group-member {
    align-items: center;
    background: #f2f4f7;
    border: 1px solid #d0d5dd;
    border-radius: 4px;
    display: flex;
    flex-wrap: wrap;
    gap: 10px;
    padding: 6px 10px;
}

.edf-exclusion-group-member-address {
    color: #475467;
    flex: 1 1 auto;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
}

.edf-exclusion-group-chevron {
    background: transparent;
    border: 0;
    color: #475467;
    cursor: pointer;
    display: inline-flex;
    flex: 0 0 auto;
    padding: 4px;
    transition: transform 150ms ease;
}

.edf-exclusion-group-chevron[aria-expanded="true"] {
    transform: rotate(90deg);
}

.edf-exclusion-group-detail {
    flex: 1 0 100%;
}
```

- [ ] **Step 4: Type-check, lint, lint CSS**

Run: `npx tsc --noEmit`
Expected: same pre-existing errors as before (index.ts, project.ts) — none in
`exclusion-group.ts` or `card.ts`.

Run: `npx eslint src/listing-cards/exclusion-group.ts src/listing-cards/card.ts`
Expected: no output.

Run: `npx stylelint src/app/main.css`
Expected: no output.

- [ ] **Step 5: Commit**

```bash
git add src/listing-cards/exclusion-group.ts src/listing-cards/card.ts src/app/main.css
git commit -m "Add adjacency grouping for consecutive excluded top-level cards"
```

---

### Task 6: Bundle blacklist helper (`listing-cards/bundle.ts`)

**Files:**
- Create: `src/listing-cards/bundle.ts`

**Interfaces:**
- Consumes: `addBlacklistEntry`/`removeBlacklistEntry`/`isBlacklisted` (`matching`),
  `getFromStorage`/`setInStorage` (`core/storage`).
- Produces: `toggleBundleBlacklist(members: BundleMember[]): Promise<void>`,
  `isBundleActive(members: { url: string }[], blacklist: BlacklistEntry[]): boolean`. Consumed by
  Task 8 (`carousel.ts`).

Scope note: the design spec anticipated more code sharing between `project.ts` and `carousel.ts`
than turned out to exist once concretely designed. A project has its own canonical URL, so
"blacklist the whole project" is just `toggle.ts`'s existing single-URL toggle — `project.ts`
needs nothing new here. A featured/topspot carousel card has *no* canonical URL of its own (it
bundles several unrelated listings, each with their own URL) — "blacklist the whole carousel"
has to mean "blacklist every current child at once," which is genuinely new logic. That's what
this module provides; the spec's assumption that the aggregate-row UI would also be shared didn't
hold either, since carousel children shrink individually rather than collapsing into an aggregate
bar (only project children use that, and `project.ts` already has it). This is expected — the
spec explicitly left exact file boundaries here for the plan to finalize.

- [ ] **Step 1: Write a throwaway verification script**

Create `/tmp/verify-bundle.mjs` (not committed):

```js
function isBundleActive(members, blacklistedUrls) {
    return members.length > 0 && members.every(m => blacklistedUrls.has(m.url));
}

const assert = (actual, expected, label) => {
    if (actual !== expected) throw new Error(`FAIL ${label}: got ${actual}, want ${expected}`);
    console.log(`PASS ${label}`);
};

assert(isBundleActive([{ url: "a" }, { url: "b" }], new Set(["a", "b"])), true, "all members blacklisted");
assert(isBundleActive([{ url: "a" }, { url: "b" }], new Set(["a"])), false, "partial blacklist is not active");
assert(isBundleActive([], new Set()), false, "empty bundle is never active");
```

- [ ] **Step 2: Run it**

Run: `node /tmp/verify-bundle.mjs`
Expected: three `PASS` lines.

- [ ] **Step 3: Write `src/listing-cards/bundle.ts`**

```ts
import { getFromStorage, setInStorage } from "../core/storage";
import {
    addBlacklistEntry,
    isBlacklisted,
    removeBlacklistEntry,
    type BlacklistEntry,
    type ListingSnapshot,
} from "../matching";

export interface BundleMember {
    url: string;
    snapshot: ListingSnapshot;
}

// The multi-URL equivalent of toggle.ts's single-listing toggleBlacklist — needed because a
// bundle card (e.g. a featured-carousel card) has no single canonical URL of its own to store
// one blacklist entry against. Toggles every member together: if all are already blacklisted,
// removes all of them; otherwise blacklists every one that isn't already.
export async function toggleBundleBlacklist(members: readonly BundleMember[]): Promise<void> {
    const current = (await getFromStorage<BlacklistEntry[]>("blacklist")) ?? [];
    const allActive = members.length > 0 && members.every(member => isBlacklisted(current, member.url));

    const next = allActive
        ? members.reduce((entries, member) => removeBlacklistEntry(entries, member.url), current)
        : members.reduce((entries, member) => addBlacklistEntry(entries, member.snapshot), current);

    await setInStorage("blacklist", next);
}

export function isBundleActive(
    members: readonly { url: string }[],
    blacklist: readonly BlacklistEntry[],
): boolean {
    return members.length > 0 && members.every(member => isBlacklisted(blacklist, member.url));
}
```

- [ ] **Step 4: Delete the throwaway script**

Run: `rm /tmp/verify-bundle.mjs`

- [ ] **Step 5: Type-check and lint**

Run: `npx tsc --noEmit && npx eslint src/listing-cards/bundle.ts`
Expected: no new errors from this file.

- [ ] **Step 6: Commit**

```bash
git add src/listing-cards/bundle.ts
git commit -m "Add bulk blacklist toggle for bundle cards (featured/topspot carousels)"
```

---

### Task 7: Featured/topspot carousel handling (`listing-cards/carousel.ts`)

**Files:**
- Create: `src/listing-cards/carousel.ts`
- Modify: `src/app/main.css`

**Interfaces:**
- Consumes: `cloneBlacklistButton`/`watchShortlistButtonClass` (existing `button.ts`),
  `getChildListingUrl`/`getListingSnapshot` (existing `card.ts`), `toggleBundleBlacklist`
  (Task 6), `isBlacklisted` (`matching`), `createClaimTracker` (existing `core/claim`).
- Produces: `bindCarouselCard(carouselCard: HTMLElement, context: PageContext): void`,
  `updateCarouselCard(carouselCard: HTMLElement, blacklist: BlacklistEntry[]): void`. Consumed by
  Task 10 (`index.ts`).

**Live spike required before Step 3** — the spec flags a real unknown: slick.js manages slide
positions/track-width via its own JS, not by reading live CSS, and we don't have a reference to
Domain's slick instance. Shrinking a slide with plain CSS might leave a gap rather than a clean
reflow.

- [ ] **Step 1: Live spike — check whether CSS + a resize event reflows slick**

Using the Chrome DevTools MCP tools (or Playwright MCP), navigate to a Domain search results page
known to have a featured/topspot carousel (e.g. a `/sale/<suburb>/` search with several results —
if rate-limited ("Access Denied"), wait and retry rather than skipping this). Then run:

```js
() => {
    const slide = document.querySelector('[data-testid="listing-card-child-listing"]')
        ?.closest('.slick-slide');
    if (!slide) return { found: false };

    const before = slide.getBoundingClientRect().width;
    slide.style.setProperty('max-width', '0px', 'important');
    slide.style.setProperty('overflow', 'hidden', 'important');
    window.dispatchEvent(new Event('resize'));
    const afterWidthStyle = slide.getBoundingClientRect().width;

    // Give slick's own resize handler (if any) a moment, then re-check.
    return new Promise(resolve => {
        setTimeout(() => {
            const nextSlide = slide.nextElementSibling;
            resolve({
                found: true,
                before,
                afterWidthStyle,
                nextSiblingTransform: nextSlide ? getComputedStyle(nextSlide.parentElement).transform : null,
            });
        }, 300);
    });
}
```

- [ ] **Step 2: Record the outcome and decide the implementation**

If the slide visibly shrinks and slick's track reflows (subsequent slides shift left to fill the
gap): the `resize` event dispatch in Step 3's code is sufficient — proceed as written below.

If it doesn't reflow (a gap remains where the slide was): this is the documented fallback in the
spec — proceed with the same code below anyway (it still visually shrinks/hides the excluded
slide's *content*, which is the primary goal), but change the code comment in Step 3 to say
reflow isn't achieved and this is an accepted known limitation, rather than claiming it works.
Either way, don't block on this — implement with whichever comment is accurate and move on.

- [ ] **Step 3: Write `src/listing-cards/carousel.ts`**

```ts
import { createClaimTracker } from "../core/claim";
import { PageContext } from "../core/router";
import { isBlacklisted, type BlacklistEntry } from "../matching";
import { cloneBlacklistButton, watchShortlistButtonClass } from "./button";
import { getChildListingUrl, getListingSnapshot } from "./card";
import { toggleBundleBlacklist } from "./bundle";

const TOPSPOT_CAROUSEL_SELECTOR = 'li[data-testid="topspot"]';
const CHILD_SLIDE_SELECTOR = '[data-testid="listing-card-child-listing"]';

const claimTopspotCard = createClaimTracker<HTMLElement>();

function findChildSlides(carouselCard: HTMLElement): HTMLElement[] {
    return [...carouselCard.querySelectorAll<HTMLElement>(CHILD_SLIDE_SELECTOR)];
}

// See Task 7's live-spike note: shrinking a slide with plain CSS may or may not cause slick to
// reflow the rest of the track. Dispatching a resize event is a low-cost attempt at triggering
// slick's own recompute; if it doesn't reflow in practice, the remaining visual gap is an
// accepted limitation rather than a blocker.
function setSlideExcluded(slide: HTMLElement, excluded: boolean): void {
    if (excluded) {
        slide.style.setProperty("max-width", "0px", "important");
        slide.style.setProperty("min-width", "0px", "important");
        slide.style.setProperty("overflow", "hidden", "important");
        slide.style.setProperty("opacity", "0", "important");
    } else {
        slide.style.removeProperty("max-width");
        slide.style.removeProperty("min-width");
        slide.style.removeProperty("overflow");
        slide.style.removeProperty("opacity");
    }

    window.dispatchEvent(new Event("resize"));
}

export function updateCarouselCard(carouselCard: HTMLElement, blacklist: BlacklistEntry[]): void {
    const members = findChildSlides(carouselCard)
        .map(slide => ({ slide, url: getChildListingUrl(slide) }))
        .filter((entry): entry is { slide: HTMLElement; url: string } => entry.url !== undefined);

    for (const { slide, url } of members) {
        setSlideExcluded(slide, isBlacklisted(blacklist, url));
    }

    const allExcluded = members.length > 0 && members.every(({ url }) => isBlacklisted(blacklist, url));
    carouselCard.hidden = allExcluded;
}

export function bindCarouselCard(carouselCard: HTMLElement, context: PageContext): void {
    if (!carouselCard.matches(TOPSPOT_CAROUSEL_SELECTOR)) return;
    if (!claimTopspotCard(carouselCard)) return;

    const sourceButton = carouselCard.querySelector<HTMLButtonElement>('[data-testid^="listing-card-shortlist"]');
    if (!sourceButton) return;

    const button = cloneBlacklistButton(sourceButton);
    button.dataset.blacklistScope = "carousel";
    button.classList.add("edf-carousel-blacklist-button");
    carouselCard.prepend(button);
    watchShortlistButtonClass(sourceButton, button, context);

    button.addEventListener("click", async event => {
        event.preventDefault();
        event.stopPropagation();

        const members = findChildSlides(carouselCard)
            .map(slide => {
                const url = getChildListingUrl(slide);
                if (!url) return undefined;
                return { url, snapshot: getListingSnapshot(slide, url) };
            })
            .filter((member): member is { url: string; snapshot: ReturnType<typeof getListingSnapshot> } =>
                member !== undefined,
            );

        await toggleBundleBlacklist(members);
    });

    void context;
}
```

- [ ] **Step 4: Add CSS for the carousel card and its whole-card button**

Append to `src/app/main.css` (positioning mirrors what the project button used before this
session's rework, per the spec):

```css
li[data-testid="topspot"] {
    position: relative !important;
}

.edf-carousel-blacklist-button {
    color: #fff !important;
    position: absolute !important;
    right: 12px !important;
    top: 12px !important;
    z-index: 2 !important;
}

.edf-carousel-blacklist-button:hover {
    color: #fc0 !important;
}

.edf-carousel-blacklist-button:active,
.edf-carousel-blacklist-button[data-active="true"],
.edf-carousel-blacklist-button[aria-pressed="true"] {
    color: #c90 !important;
}
```

- [ ] **Step 5: Type-check, lint, lint CSS**

Run: `npx tsc --noEmit`
Expected: same pre-existing errors as before (index.ts, project.ts) — none in `carousel.ts`.

Run: `npx eslint src/listing-cards/carousel.ts`
Expected: no output.

Run: `npx stylelint src/app/main.css`
Expected: no output.

- [ ] **Step 6: Commit**

```bash
git add src/listing-cards/carousel.ts src/app/main.css
git commit -m "Add featured/topspot carousel per-child shrink and whole-card blacklist button"
```

---

### Task 8: Update `project.ts` to use `exclusion-row.ts`

**Files:**
- Modify: `src/listing-cards/project.ts`

**Interfaces:**
- Consumes: `getExclusionRow` (Task 4, replacing the bespoke `getProjectSummary`).
- Produces: same exports as before — `updateProjectBlacklistSummary`, `bindProjectCard` — so
  Task 9 (`index.ts`) doesn't need to change its import names for this module, only its call
  sites for the renamed matching fields.

Per the design spec: "placed within the project card's own layout (not a separately-styled
one-off as it is today)." Reuse `exclusion-row.ts`'s markup/classes for the aggregate bar instead
of `project.ts` building its own summary DOM from scratch.

- [ ] **Step 1: Replace `getProjectSummary` with a thin wrapper around `getExclusionRow`**

In `src/listing-cards/project.ts`, replace the imports:

```ts
import { createClaimTracker } from "../core/claim";
import { queueForegroundContrastSync } from "../core/contrast";
import { PageContext } from "../core/router";
import { getFromStorage, setInStorage } from "../core/storage";
import { isBlacklisted, removeBlacklistEntry, type BlacklistEntry } from "../matching";
import { cloneBlacklistButton, watchShortlistButtonClass } from "./button";
import {
    getChildListingUrl,
    PROJECT_DETAILS_SELECTOR,
    PROJECT_MARKER_SELECTOR,
    SHORTLIST_BUTTON_SELECTOR,
} from "./card";
import { getExclusionRow } from "./exclusion-row";
import { toggleBlacklist } from "./toggle";
```

Replace `getProjectSummary` and the top of `updateProjectBlacklistSummary`:

```ts
const claimProjectCard = createClaimTracker<HTMLElement>();

// Reuses exclusion-row.ts's markup for the aggregate bar instead of building bespoke DOM, per
// the design spec — this sits on the project card itself (not per-child), right after the
// project header, since project children are hidden individually with one combined restore
// action rather than each getting their own row. getExclusionRow() itself prepends a freshly
// created row to the very start of the card, so this moves it into position right after
// (idempotent — a no-op once it's already there).
function getProjectAggregateRow(projectCard: HTMLElement, projectHeader: HTMLElement): HTMLElement {
    const row = getExclusionRow(projectCard);
    if (row.previousElementSibling !== projectHeader) {
        projectHeader.after(row);
    }
    return row;
}
```

- [ ] **Step 2: Update `updateProjectBlacklistSummary` to use the new row + button API**

```ts
// Child listings within a project are hidden outright when blacklisted (no per-row collapsed
// bar) — instead a single aggregate row on the project card itself surfaces how many are hidden
// and lets the user restore them all at once.
export function updateProjectBlacklistSummary(
    projectCard: HTMLElement,
    projectHeader: HTMLElement,
    blacklist: BlacklistEntry[],
): void {
    const children = [...projectCard.querySelectorAll<HTMLElement>('[data-testid="listing-card-child-listing"]')];
    const blacklistedUrls = children
        .map(child => ({ child, url: getChildListingUrl(child) }))
        .filter((entry): entry is { child: HTMLElement; url: string } =>
            entry.url !== undefined && isBlacklisted(blacklist, entry.url),
        );

    const blacklistedChildren = new Set(blacklistedUrls.map(entry => entry.child));
    for (const child of children) {
        child.hidden = blacklistedChildren.has(child);
    }

    const existingRow = projectCard.querySelector('[data-testid="listing-card-exclusion-row"]');
    if (blacklistedUrls.length === 0) {
        existingRow?.remove();
        return;
    }

    const row = getProjectAggregateRow(projectCard, projectHeader);
    const text = row.querySelector<HTMLElement>('[data-testid="listing-card-exclusion-row-text"]');
    if (text) {
        text.textContent = blacklistedUrls.length === 1
            ? "1 property blacklisted"
            : `${blacklistedUrls.length} properties blacklisted`;
    }

    const button = row.querySelector<HTMLButtonElement>('[data-testid="listing-card-exclusion-restore"]');
    if (button) {
        button.lastChild!.textContent = "Unblacklist all";
        button.onclick = async event => {
            event.preventDefault();
            event.stopPropagation();

            const current = (await getFromStorage<BlacklistEntry[]>("blacklist")) ?? [];
            const next = blacklistedUrls.reduce(
                (entries, entry) => removeBlacklistEntry(entries, entry.url),
                current,
            );
            await setInStorage("blacklist", next);
        };
    }
}
```

- [ ] **Step 3: Update `bindProjectCard`'s use of `getSummary`**

Replace the `getSummary(projectCard)` call with `getExclusionRow(projectCard)` (same function,
new name/module) — the rest of `bindProjectCard` (button cloning, `insertProjectBlacklistButton`,
click handlers calling `toggleBlacklist`) is unchanged:

```ts
    getExclusionRow(projectCard)
        .querySelector<HTMLButtonElement>('[data-testid="listing-card-exclusion-restore"]')
        ?.addEventListener("click", event => {
            event.preventDefault();
            event.stopPropagation();
            void toggleBlacklist(projectCard, url, context, sourceButton, button);
        });
```

- [ ] **Step 4: Type-check and lint**

Run: `npx tsc --noEmit`
Expected: only `src/listing-cards/index.ts` still has errors (fixed in Task 9). No errors in
`project.ts`.

Run: `npx eslint src/listing-cards/project.ts`
Expected: no output.

- [ ] **Step 5: Commit**

```bash
git add src/listing-cards/project.ts
git commit -m "Update project.ts to reuse exclusion-row.ts instead of its own summary markup"
```

---

### Task 9: Orchestration rewiring (`listing-cards/index.ts`)

**Files:**
- Modify: `src/listing-cards/index.ts`

**Interfaces:**
- Consumes: everything produced by Tasks 1, 3, 4, 5, 7 — `ExclusionReason` (Task 1),
  `isRevealed` (Task 3), `applyExclusionState`/`updateExclusionRow`/`ensureHideAgainAffordance`/`removeHideAgainAffordance`
  (Task 4), `updateExclusionGroups` (Task 5), `bindCarouselCard`/`updateCarouselCard` (Task 7).
- Produces: same public exports as before (`injectListingCards`, `bindListingCards`,
  `BindListingCardsOptions`) — no signature changes, so `pages/search.ts`/`pages/shortlist.ts`
  need no changes.

This is the task that actually makes the whole feature compile and run together.

- [ ] **Step 1: Rewrite `src/listing-cards/index.ts`**

```ts
import { createClaimTracker } from "../core/claim";
import { PageContext } from "../core/router";
import { getSettings, type Settings } from "../core/settings";
import { getFromStorage, onStorageChange } from "../core/storage";
import { matchListing, type BlacklistEntry, type ExclusionReason } from "../matching";
import { bindAdRemoval } from "./ads";
import { cloneBlacklistButton, insertBlacklistButton, updateButton, watchShortlistButtonClass } from "./button";
import { bindCarouselCard, updateCarouselCard } from "./carousel";
import {
    BLACKLIST_BUTTON_SELECTOR,
    getCard,
    getListingSnapshot,
    getListingUrl,
    PROJECT_CARD_SELECTOR,
    PROJECT_MARKER_SELECTOR,
    SHORTLIST_BUTTON_SELECTOR,
} from "./card";
import { updateExclusionGroups } from "./exclusion-group";
import {
    applyExclusionState,
    ensureHideAgainAffordance,
    isRevealed,
    removeHideAgainAffordance,
    updateExclusionRow,
} from "./exclusion-row";
import { bindProjectCard, updateProjectBlacklistSummary } from "./project";
import { toggleBlacklist } from "./toggle";

const claimShortlistButton = createClaimTracker<HTMLButtonElement>();

// A "filtered" reason is suppressed back to "none" if the user has revealed it this session —
// applied here (not inside matching/index.ts) so matching stays a pure, DOM/session-free
// computation; only listing-cards' UI layer knows about the session-only reveal set.
function resolveExclusionReason(rawReason: ExclusionReason, url: string): ExclusionReason {
    return rawReason === "filtered" && isRevealed(url) ? "none" : rawReason;
}

function updateExistingCards(
    settings: Settings,
    blacklist: BlacklistEntry[],
    showBlacklistedView: boolean,
): void {
    document.querySelectorAll<HTMLButtonElement>(BLACKLIST_BUTTON_SELECTOR)
        .forEach(button => {
            const card = getCard(button);
            if (!card) return;

            const url = getListingUrl(button, card);
            if (!url) return;

            const rawMatch = matchListing(getListingSnapshot(card, url), settings, blacklist);
            const reason = resolveExclusionReason(rawMatch.exclusionReason, url);

            updateButton(button, reason === "blacklisted");

            // Project children are hidden/restored in bulk via updateProjectBlacklistSummary
            // instead — leave this card's own visibility alone here.
            if (card.matches('[data-testid="listing-card-child-listing"]') &&
                card.closest(PROJECT_CARD_SELECTOR)?.querySelector(PROJECT_MARKER_SELECTOR)) {
                return;
            }

            if (showBlacklistedView) {
                applyExclusionState(card, button, reason);

                if (reason === "none" && rawMatch.exclusionReason === "filtered") {
                    ensureHideAgainAffordance(card, url);
                } else {
                    removeHideAgainAffordance(card);
                }

                if (reason !== "none") {
                    updateExclusionRow(card, url, reason);
                }
            }

            (card as HTMLElement).style.outline = reason === "none" && rawMatch.matchedPreferences.length > 0
                ? "3px solid #fc0"
                : "";
        });

    for (const projectCard of document.querySelectorAll<HTMLElement>(PROJECT_CARD_SELECTOR)) {
        const projectHeader = projectCard.querySelector<HTMLElement>(PROJECT_MARKER_SELECTOR);
        if (projectHeader) updateProjectBlacklistSummary(projectCard, projectHeader, blacklist);
    }

    for (const carouselCard of document.querySelectorAll<HTMLElement>('li[data-testid="topspot"]')) {
        updateCarouselCard(carouselCard, blacklist);
    }

    if (showBlacklistedView) updateExclusionGroups();
}

function bindBlacklistButton(
    shortlistButton: HTMLButtonElement,
    context: PageContext
): HTMLButtonElement | undefined {
    const card = getCard(shortlistButton);
    if (!card) return undefined;

    const url = getListingUrl(shortlistButton, card);
    if (!url) return undefined;

    const button = cloneBlacklistButton(shortlistButton);
    insertBlacklistButton(shortlistButton, button);
    watchShortlistButtonClass(shortlistButton, button, context);

    button.addEventListener("click", async event => {
        event.preventDefault();
        event.stopPropagation();
        await toggleBlacklist(card, url, context, shortlistButton, button);
    });

    return button;
}

export async function injectListingCards(
    context: PageContext,
    showBlacklistedView = true,
): Promise<void> {
    for (const projectCard of document.querySelectorAll<HTMLElement>(PROJECT_CARD_SELECTOR)) {
        bindProjectCard(projectCard, context);
    }

    for (const carouselCard of document.querySelectorAll<HTMLElement>('li[data-testid="topspot"]')) {
        bindCarouselCard(carouselCard, context);
    }

    for (const shortlistButton of document.querySelectorAll<HTMLButtonElement>(SHORTLIST_BUTTON_SELECTOR)) {
        if (!claimShortlistButton(shortlistButton)) continue;
        bindBlacklistButton(shortlistButton, context);
    }

    const [settings, blacklist = []] = await Promise.all([
        getSettings(),
        getFromStorage<BlacklistEntry[]>("blacklist"),
    ]);

    updateExistingCards(settings, blacklist, showBlacklistedView);
}

export interface BindListingCardsOptions {
    // The real /user/shortlist page has its own dedicated blacklist overlay (?blacklist=1) for
    // managing blacklisted entries, so the inline collapsed exclusion-row treatment there is
    // redundant and confusing — set to false to suppress it while still keeping the button
    // itself functional.
    showBlacklistedView?: boolean;
}

export function bindListingCards(
    context: PageContext,
    options: BindListingCardsOptions = {},
): void {
    const showBlacklistedView = options.showBlacklistedView ?? true;

    bindAdRemoval(context.signal);

    // Scoped to this mount, not module-level — see git history for why (a shared module-level
    // scanFrame previously broke card injection after mode/pagination changes).
    let scanFrame: number | undefined;

    const schedule = (): void => {
        if (scanFrame !== undefined) return;

        scanFrame = requestAnimationFrame(() => {
            scanFrame = undefined;
            void injectListingCards(context, showBlacklistedView).catch(error =>
                context.logger.warn("Failed to inject listing cards", error)
            );
        });
    };

    schedule();

    const observer = new MutationObserver(schedule);
    observer.observe(document.body, { childList: true, subtree: true });
    context.signal.addEventListener("abort", () => {
        observer.disconnect();
        if (scanFrame !== undefined) {
            cancelAnimationFrame(scanFrame);
            scanFrame = undefined;
        }
    }, { once: true });

    const refresh = (): void => {
        void injectListingCards(context, showBlacklistedView).catch(error =>
            context.logger.warn("Failed to refresh listing cards", error)
        );
    };
    const unwatchBlacklist = onStorageChange<BlacklistEntry[]>("blacklist", refresh);
    const unwatchSettings = onStorageChange("settings", refresh);

    context.signal.addEventListener("abort", () => {
        unwatchBlacklist();
        unwatchSettings();
    }, { once: true });
}
```

- [ ] **Step 2: Type-check the whole project**

Run: `npx tsc --noEmit`
Expected: no errors anywhere now — this was the last file with pre-existing errors from earlier
tasks.

- [ ] **Step 3: Lint**

Run: `npx eslint src/listing-cards/index.ts`
Expected: no output.

- [ ] **Step 4: Full build**

Run: `npx vite build`
Expected: builds cleanly, `dist/assets/listing-cards-*.js` and `dist/assets/matching-*.js`
chunks present (sizes will differ from before given all the new modules — that's expected).

- [ ] **Step 5: Commit**

```bash
git add src/listing-cards/index.ts
git commit -m "Wire exclusion-row, exclusion-group, carousel, and the new match model into orchestration"
```

---

### Task 10: Final verification pass

**Files:** none (verification only).

- [ ] **Step 1: Full clean build**

Run: `npx tsc --noEmit && npx eslint src && npx stylelint src/app/main.css && npx vite build`
Expected: all four commands succeed with no errors/warnings.

- [ ] **Step 2: Live spot-check the golden paths**

Using Chrome DevTools MCP or Playwright MCP (retry if rate-limited), load the built extension
(see project README for the unpacked-load steps if not already loaded in a persistent profile)
against a real search results page and manually verify:

1. A single blacklisted card collapses into an exclusion row with a working "Unblacklist" button
   that restores it with the animated transition (not an instant snap).
2. A filtered-out card (set a strata max or exclude keyword in the extension's filter UI first)
   collapses with an eye icon and "Show anyway" button; clicking it reveals the real card with a
   visible "hide again" eye-off button; clicking that re-collapses it.
3. Three or more adjacent excluded cards (mix blacklist + filter for at least one test) show as a
   single "N listings hidden" group row; hovering expands to per-listing lines with chevrons;
   clicking a chevron reveals that listing's summary + action button; clicking the action button
   removes it from the group and shows it as a real card.
4. A featured/topspot carousel: blacklist one child via its own button and confirm its slide
   shrinks (record whether the track reflows cleanly per Task 7's live-spike finding); use the new
   top-right button to blacklist the whole carousel at once and confirm all children shrink/hide
   and the whole `<li>` disappears once every child is excluded.
5. A project: blacklisting the whole project (existing inline button near the address) collapses
   the whole project card into the standard exclusion row (no popup, animated). Blacklisting an
   individual project unit hides it and shows/updates the aggregate row on the project card.
6. Change pagination pages and switch buy/rent mode at least once each; confirm no console errors
   (specifically no `NotFoundError: insertBefore`/`removeChild` — the historical crash class this
   plan's Global Constraints section addresses) and that cards on the new page get exclusion rows
   applied correctly (confirms the `scanFrame` fix and this plan's changes coexist correctly).

- [ ] **Step 3: Fix anything found during the live check**

If any of the above don't match expectations, fix them now as follow-up commits to the relevant
task's file(s) — don't accumulate a list of known-broken behavior at the end of this plan.

- [ ] **Step 4: Final commit (if fixes were needed)**

```bash
git add -A
git commit -m "Fix issues found during live verification of the exclusion UI"
```
