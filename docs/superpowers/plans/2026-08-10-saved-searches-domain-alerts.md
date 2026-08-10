# Saved Searches and Domain Alerts Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace every saved-search card and alert editor with one owned card/popover system while preserving real Domain Daily/Weekly emails and making Never distinct from deletion.

**Architecture:** Saved-search models and renderers remain extension-owned. A semantic Domain adapter is the only module allowed to drive Domain's authenticated alert form or native saved-search menu. Domain page and popup collections consume the Package 1 collection frame and primitives.

**Tech Stack:** TypeScript, DOM APIs, Chrome storage, Firebase Firestore rules, CSS.

## Global Constraints

- Package 1 must be complete first.
- Do not add automated test specifications, test files, or a test framework.
- Daily/Weekly must produce real Domain email alerts.
- Never must retain the extension saved search with `notificationFrequency: "none"`.
- Delete must be a separate destructive action.
- Remove every full-page saved-search modal path and stylesheet.
- Use no Domain CSS-hash selectors in migrated saved-search/alert code.

---

### Task 1: Normalize saved-search operations and Domain adapters

**Files:**
- Create: `src/shared/domain/alerts.ts`
- Create: `src/shared/domain/savedSearches.ts`
- Modify: `src/features/saved-searches/domainAdapter.ts`
- Modify: `src/domain/searches/savedSearches.ts`

**Interfaces:**
- Produces: `DomainAlertBridge.apply(request): Promise<DomainAlertResult>`.
- Produces: `readDomainSavedSearches(stored): SavedSearch[]` and
  `removeDomainSavedSearch(domainId): Promise<void>`.

- [ ] **Step 1: Define typed alert outcomes**

```ts
export type DomainAlertFrequency = "daily" | "none" | "weekly";
export type DomainAlertFailure = "cancelled" | "changed-markup" | "rejected" | "timed-out" | "unavailable";

export type DomainAlertResult =
    | { ok: true; frequency: DomainAlertFrequency }
    | { ok: false; reason: DomainAlertFailure; message: string };

export interface DomainAlertRequest {
    frequency: DomainAlertFrequency;
    signal: AbortSignal;
    trigger: HTMLButtonElement;
}
```

- [ ] **Step 2: Implement semantic form discovery and bounded waits**

Activate the trigger, wait at most 4 seconds for a dialog/tooltip containing an alert form,
set it `hidden`, `inert`, and `aria-hidden`, locate frequency controls by role/name/value,
submit Daily/Weekly, and confirm the trigger/form state. For Never, invoke Domain's
disable-alert operation when one exists, but return success without touching extension
storage. Capture and restore the native form's original hidden/inert/ARIA state on success,
failure, timeout, cancellation, and scope disposal.

- [ ] **Step 3: Move native saved-search import/removal behind the adapter**

Keep `domainAdapter.ts` as a compatibility re-export during migration, then delete it after
page consumers move. Removal must locate the saved-search entry by `data-savedsearch-id`,
open its semantic menu, and activate the accessible "Remove search" option.

- [ ] **Step 4: Verify and commit**

Run `npm run typecheck && npm run eslint`, manually exercise the adapter against a logged-in
Domain session, then commit.

### Task 2: Rebuild the saved-search card as the primary action

**Files:**
- Modify: `src/features/saved-searches/card.ts`
- Modify: `src/features/saved-searches/card/actions.ts`
- Modify: `src/features/saved-searches/card/content.ts`
- Modify: `src/features/saved-searches/card/types.ts`
- Modify: `src/features/saved-searches/card/card.css`
- Modify: `src/features/saved-searches/styles.css`
- Modify: `src/shared/ui/icons.ts`

**Interfaces:**
- Produces: `createSavedSearchCard(search, options): HTMLElement` with `density` and
  `onEditAlert`, `onRemove`, `onSave`, `onSelectionChange` callbacks.

- [ ] **Step 1: Replace the card structure**

Render one article containing a full-card primary anchor, a control-safe selection slot,
content summary, and one action rail. Remove the `saved-searches__view-properties` anchor
and "View Properties" text entirely.

- [ ] **Step 2: Standardize actions**

Alert, Share, and Delete use 36x36 `createUiButton({ variant: "icon" })` controls. Share uses
the new `replaceWithSavedSearchShareIcon`, copies the link, and announces "Search link
copied".
Delete uses the danger hover/focus state. All actions stop primary-link navigation.

- [ ] **Step 3: Use density modifiers only**

Add `data-density="compact|comfortable"` to the same card root. Remove popup selectors that
reconstruct card layout separately.

- [ ] **Step 4: Verify and commit**

Run `npm run check:all`. Manually confirm the whole card navigates, action/checkbox clicks
do not, and all three action buttons are equal size on page and popup, then commit.

### Task 3: Build the shared create/edit alert popover

**Files:**
- Create: `src/features/saved-searches/alertPopover.ts`
- Create: `src/features/saved-searches/alertPopover.css`
- Modify: `src/features/saved-searches/styles.css`
- Modify: `manifest.config.ts`
- Modify: `src/popup/popup.ts`

**Interfaces:**
- Produces: `openSavedSearchAlertPopover(options): Promise<void>`.

- [ ] **Step 1: Define one create/edit contract**

```ts
export interface SavedSearchAlertPopoverOptions {
    anchor: HTMLElement;
    mode: "create" | "edit";
    onDelete?(): Promise<void>;
    onSave(frequency: SearchNotificationFrequency): Promise<void>;
    search: SavedSearch;
    signal?: AbortSignal;
}
```

- [ ] **Step 2: Render one compact form**

Use the shared popover and dropdown. Options are exactly Daily, Weekly, Never. Actions are
Cancel and Create/Update; add a separate Delete button only in edit mode when `onDelete`
exists. Do not include off-market controls or a page overlay.

- [ ] **Step 3: Preserve state on errors**

Disable submitted controls, show an inline error region with `role="alert"`, keep the
popover open on failure, and close only after the callback resolves.

- [ ] **Step 4: Register CSS, verify, and commit**

Run `npm run check:all`, manually inspect focus return/outside click/Escape at popup and page
edges, then commit.

### Task 4: Replace home/search native alert patching

**Files:**
- Rewrite: `src/features/filters/alerts.ts`
- Modify: `src/features/filters/index.ts`
- Modify: `src/features/filters/homeSearch.ts`
- Modify: `src/pages/home.ts`
- Modify: `src/pages/search.ts`

**Interfaces:**
- Consumes: `DomainAlertBridge`, `openSavedSearchAlertPopover`, saved-search repository.
- Produces: `bindPropertyAlertControls(context): void`.

- [ ] **Step 1: Reduce alerts.ts to orchestration**

Find semantic `button[name="property-alert"]` triggers, intercept activation before Domain
opens its visible form, resolve the current extension search, and open the owned popover.
Delete all mutation of Domain titles, body copy, button classes, dropdown text, hidden input
values, and `DELETE` normalization.

- [ ] **Step 2: Implement frequency transactions**

For Daily/Weekly, require a successful Domain bridge result before `saveSearch`. For Never,
disable the native alert when applicable and save `none`. For Delete, remove the native
search when it has a Domain ID, then remove local state.

- [ ] **Step 3: Keep trigger state derived from repository and Domain state**

Use "Create alert" when neither source has an alert/search and "Edit alert" otherwise.
Use owned selected-state styling without cloning Domain classes.

- [ ] **Step 4: Verify and commit**

Run `npm run check:all`. Manually verify create Daily, edit Weekly, edit Never, reopen Never,
Delete, Cancel, Domain rejection, and adapter timeout. Confirm Never never removes the local
card. Commit.

### Task 5: Consolidate saved-search page and popup collections

**Files:**
- Create: `src/features/saved-searches/collection.ts`
- Modify: `src/pages/savedSearches.ts`
- Modify: `src/popup/views/savedSearches.ts`
- Modify: `src/shared/collections/controller.ts`
- Modify: `src/shared/ui/collectionView.ts`
- Modify: `src/shared/ui/collection.css`
- Delete: `src/features/saved-searches/domainAdapter.ts`

**Interfaces:**
- Consumes: Package 1 `CollectionController` and `CollectionFrame`.

- [ ] **Step 1: Extract one saved-search collection factory**

Create `createSavedSearchCollection({ density, openLinksInNewTab, searches, signal })` in
`src/features/saved-searches/collection.ts`. It owns filter/sort/selection/bulk removal and
configures the generic `CollectionController`; it renders the result through a
`CollectionFrame` and returns that frame's root. Do not add another saved-search state
store beside the controller.

- [ ] **Step 2: Make page and popup thin mounts**

The Domain page adapter imports native records and supplies them to the collection. The
popup supplies storage records. Remove duplicated renderGrid/renderCards, toolbar, tabs,
sort, and selection loops from both files.

- [ ] **Step 3: Verify and commit**

Run `npm run check:all`. Compare All/Buy/Rent, sorting, single selection, select all, bulk
remove, empty state, and card actions on both surfaces, then commit.

### Task 6: Delete modal code and correct sync rules

**Files:**
- Delete: `src/features/saved-searches/card/modal.ts`
- Delete: `src/features/saved-searches/card/modal.css`
- Modify: `src/features/saved-searches/card.ts`
- Modify: `src/features/saved-searches/card/actions.ts`
- Modify: `src/features/saved-searches/card/types.ts`
- Modify: `src/features/saved-searches/styles.css`
- Modify: `manifest.config.ts`
- Modify: `firebase/firestore.rules`

- [ ] **Step 1: Remove modal APIs and flags**

Delete `openAlertModal`, `compactAlertModal`, all modal test IDs/classes, and manifest/import
references.

- [ ] **Step 2: Permit synchronized new-listing counts**

Add `newListingCount` to the allowed saved-search value keys and require it, when present,
to be an integer greater than or equal to zero.

- [ ] **Step 3: Search for obsolete paths**

Run:

```powershell
rg -n "openAlertModal|compactAlertModal|saved-search-modal|I don't want alerts anymore|value === \"DELETE\"|css-19fbufk|css-1iniab3" src manifest.config.ts
```

Expected: no matches.

- [ ] **Step 4: Final verification and commit**

Run `npm run check:all && npm run build`, repeat the alert and collection manual matrix, and
commit with `git commit -m "refactor: replace saved search alert surfaces"`.
