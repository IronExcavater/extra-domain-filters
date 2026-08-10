# Specification Closure and Clone Cleanup Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Close every verified listing-exclusion specification gap, migrate remaining extension-created cloned surfaces to the shared platform, and remove superseded/dead code.

**Architecture:** Listing matching produces the final visible exclusion decision through an explicit reveal policy. Carousel and grouping renderers consume normalized decisions instead of independently inferring blacklist state. Remaining filter/recent-search/profile extensions use Package 1 primitives and replacement slots, leaving raw Domain DOM knowledge in adapters only.

**Tech Stack:** TypeScript, DOM APIs, CSS, Chrome Extension MV3, Vite.

## Global Constraints

- Packages 1 through 3 must be complete first.
- Follow `docs/superpowers/specs/2026-07-12-listing-exclusion-ui-design.md` for listing behavior.
- Do not add automated test specifications, test files, or a test framework.
- Do not clone Domain nodes or copy Domain CSS classes for extension-created UI.
- Remove abstractions and files only after all consumers migrate.
- Preserve session-only reveal behavior and persistent blacklist soft deletion.

---

### Task 1: Move reveal policy to the matching boundary

**Files:**
- Modify: `src/domain/matching/index.ts`
- Modify: `src/features/listing-cards/exclusion/reveal.ts`
- Modify: `src/features/listing-cards/update.ts`

**Interfaces:**
- Produces: optional `ListingMatchPolicy` argument for `matchListing`.

- [ ] **Step 1: Define the explicit policy**

```ts
export interface ListingMatchPolicy {
    isFilteredListingRevealed?(url: string): boolean;
}

export function matchListing(
    listing: ListingSnapshot,
    settings: Settings,
    blacklist: readonly BlacklistEntry[],
    policy?: ListingMatchPolicy,
): ListingMatch;
```

After blacklist priority, compute the filtered candidate and return `none` when the policy
reports the URL revealed. Blacklisted always wins.

- [ ] **Step 2: Remove downstream reason rewriting**

Delete `resolveVisibleReason`. Pass `isRevealed` into `matchListing`. Preserve enough raw
filter information for the expanded card to show the Hide again affordance by adding
`filterMatched: boolean` to `ListingMatch`.

- [ ] **Step 3: Verify and commit**

Run `npm run typecheck && npm run eslint`; manually reveal/hide a filtered standard listing
and confirm a blacklisted listing cannot be revealed; commit.

### Task 2: Implement filtered carousel children and all-excluded behavior

**Files:**
- Modify: `src/features/listing-cards/cards/carousel.ts`
- Modify: `src/features/listing-cards/update.ts`
- Modify: `src/features/listing-cards/carousel.css`
- Modify: `src/features/listing-cards/exclusion/styles.css`

**Interfaces:**
- Produces: `updateCarouselCard(card, decisions): void`.

- [ ] **Step 1: Pass normalized child decisions**

```ts
export interface CarouselListingDecision {
    exclusionReason: ExclusionReason;
    snapshot: ListingSnapshot;
    url: string;
}
```

Build decisions with cached enrichment, settings, blacklist, and reveal policy for every
unique child URL. Do not skip carousel children in `updateListingCards`.

- [ ] **Step 2: Apply child states**

Blacklisted and filtered slides receive the same excluded-slide class plus a reason data
attribute. Restoring/revealing removes it. Advance from an excluded current slide when a
visible sibling exists.

- [ ] **Step 3: Hide an all-excluded carousel**

Set the containing top-level card hidden only when it has at least one member and every
member is excluded. Remove the current unconditional `carouselCard.hidden = false`.

- [ ] **Step 4: Validate carousel reflow and commit**

On a live featured carousel, blacklist and filter children individually, dispatch the
existing resize/reconciliation path, and record whether Slick closes the gap. If it cannot,
retain the approved visual-gap fallback without adding private Slick API calls. Run
`npm run check:all`, then commit.

### Task 3: Restore the required three-level exclusion-group disclosure

**Files:**
- Modify: `src/features/listing-cards/exclusion/compact.ts`
- Modify: `src/features/listing-cards/exclusion/styles.css`
- Modify: `src/features/listing-cards/exclusion/row.ts`
- Modify: `src/features/listing-cards/update.ts`

- [ ] **Step 1: Separate group expansion from item expansion**

Group hover/focus reveals compact item rows. Each item's chevron toggles an inline detail
area containing reason text and an explicit Unblacklist/Show anyway action. The chevron
must not perform restoration directly.

- [ ] **Step 2: Correct mixed-group accessibility**

Use "Expand hidden listings" and "Collapse hidden listings" labels. Item labels name their
actual reason and action. Preserve the 180 ms pointer/focus collapse grace period.

- [ ] **Step 3: Replace broad FLIP movement with scoped collapse motion**

Delete `layoutAnimations` and card transforms from `update.ts`. Use max-height/opacity only
on exclusion rows, group bodies, item details, and excluded card shells. Respect reduced
motion.

- [ ] **Step 4: Verify and commit**

Manually verify adjacent blacklisted, filtered, and mixed runs; hover/focus expansion;
per-item chevrons; restore; group shrink/dissolve; and reduced motion. Run
`npm run check:all`, then commit.

### Task 4: Replace cloned extension filter and recent-search UI

**Files:**
- Create: `src/shared/domain/filters.ts`
- Create: `src/features/filters/controls.ts`
- Modify: `src/features/filters/index.ts`
- Modify: `src/features/filters/bindings/checkbox.ts`
- Modify: `src/features/filters/bindings/text.ts`
- Modify: `src/features/filters/bindings/slider.ts`
- Modify: `src/features/filters/recentSearches.ts`
- Modify: `src/features/filters/share.ts`
- Modify: `src/features/filters/styles.css`
- Delete after migration: `src/features/filters/clone/action.ts`
- Delete after migration: `src/features/filters/clone/checkbox.ts`
- Delete after migration: `src/features/filters/clone/slider.ts`
- Delete after migration: `src/features/filters/clone/text.ts`

**Interfaces:**
- Produces owned `createCheckboxControl`, `createTextControl`, `createRangeControl`, and
  `createFilterAction` functions.

- [ ] **Step 1: Move host discovery to the Domain adapter**

Return stable native filter insertion hosts and mode data; do not expose native templates
to feature renderers.

- [ ] **Step 2: Render owned controls**

Build labels, clear actions, inputs, slider tracks/handles, validation, and focus states from
shared primitives. Existing property bindings remain the source of draft/commit behavior.

- [ ] **Step 3: Rebuild recent-search and share surfaces**

Render recent-search cards from saved model data instead of cloning a Domain card. Render
the Share action from `createUiButton`. Remove `.css-d3a0h7` and native-class copying.

- [ ] **Step 4: Delete clone helpers and verify**

Run `rg -n "cloneNode|features/filters/clone|css-d3a0h7" src/features/filters` and require no
matches. Run `npm run check:all`, manually exercise every extension filter in buy/rent/home
modes, then commit.

### Task 5: Replace profile/account-menu cloned entries

**Files:**
- Create: `src/shared/domain/profile.ts`
- Modify: `src/features/settings/profile.ts`
- Modify: `src/features/account/index.ts`
- Modify: `src/features/account/styles.css`
- Delete after migration: `src/features/account/clone/menuItem.ts`

- [ ] **Step 1: Isolate semantic insertion slots**

The adapter returns the profile navigation host, content host, and account-menu list host
without returning native template nodes or CSS-hash classes.

- [ ] **Step 2: Render owned entries and settings panel controls**

Create extension preference/account rows with owned markup, shared buttons, badges, active
state, and keyboard semantics. Use replacement slots to hide/restore Domain content while
the extension preferences panel is active.

- [ ] **Step 3: Remove cloned menu implementation and hash selectors**

Require no matches for `css-1nlilx1`, `css-1jo5qpx`, `cloneNode`, or
`features/account/clone` in migrated modules.

- [ ] **Step 4: Verify and commit**

Run `npm run check:all`; manually open/close account menu, navigate to My Searches,
Blacklist, Preferences, login/out, and restore the native profile panel; commit.

### Task 6: Remove remaining dead code and verify the complete audit

**Files:**
- Delete: `domain.js`
- Modify: `README.md`
- Modify only as required by the audit: migrated files under `src/features`, `src/pages`,
  `src/popup`, and `manifest.config.ts`.

- [ ] **Step 1: Prove and remove the legacy bundle**

Run `rg -n "domain\.js" . -g '!node_modules/**' -g '!dist/**' -g '!release/**'`; after the
only result is the file itself, delete it and remove obsolete README references if present.

- [ ] **Step 2: Run the final direct-patching audit**

Run:

```powershell
rg -n "cloneNode|css-[a-zA-Z0-9_-]+|openAlertModal|saved-search-modal|compactAlertModal" src manifest.config.ts
```

Classify any remaining match. Keep only a selector that targets native Domain functionality
which has not been replaced and cannot be selected semantically; document that exception
next to the adapter constant. Remove every extension-skin or migrated-feature match.

- [ ] **Step 3: Run complete verification**

Run `npm run check:all && npm run build`. Execute the manual matrices from all four plans,
including popup transitions, alert email frequencies, saved-search actions, all login
providers, blacklist placements, navbar behavior, every listing-exclusion card shape,
extension filters, recent searches, profile replacement, and route teardown/restoration.

- [ ] **Step 4: Inspect code-size consolidation**

Compare tracked TypeScript/CSS line counts before and after. Confirm removed modal, clone,
and duplicate collection files are not replaced by parallel one-consumer frameworks.

- [ ] **Step 5: Commit final cleanup**

```powershell
git add -A -- domain.js README.md src manifest.config.ts
git commit -m "refactor: complete extension UI replacement"
```
