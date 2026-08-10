# UI Foundation and High-Churn Controls Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace duplicated extension UI foundations, unstable popup transitions, cloned blacklist controls, tooltips, and speculative navbar chevrons with shared extension-owned systems.

**Architecture:** Extend the existing lifecycle and shared UI modules instead of adding a second framework. Domain DOM knowledge moves into semantic adapters; feature code mounts owned controls through one replacement-slot lifecycle. Existing call sites migrate incrementally through compatible primitive overloads so every commit builds.

**Tech Stack:** TypeScript, DOM APIs, CSS, Chrome Extension Manifest V3, Vite.

## Global Constraints

- Do not add automated test specifications, test files, or a test framework.
- Extension-created controls must not copy or retain Domain CSS class names.
- Prefer semantic Domain selectors: `data-testid`, role, accessible name, control name, and value.
- Preserve working Google sign-in and current storage/synchronization behavior.
- Leave `.vscode/launch.json` untouched.
- Verify each task with focused typecheck/lint/style checks and finish with a production build plus manual browser checks.

---

### Task 1: Consolidate owned control primitives and tokens

**Files:**
- Modify: `src/app/tokens.css`
- Modify: `src/shared/ui/elements.ts`
- Modify: `src/shared/ui/domainControls.css`
- Create: `src/shared/ui/popover.ts`
- Create: `src/shared/ui/popover.css`
- Modify: `manifest.config.ts`
- Modify: `src/popup/popup.ts`

**Interfaces:**
- Produces: `ButtonVariant = "danger" | "icon" | "primary" | "quiet" | "secondary"`.
- Produces: `createUiButton(options: UiButtonOptions): HTMLButtonElement`.
- Produces: `openPopover(options: PopoverOptions): PopoverHandle`.

- [ ] **Step 1: Add the owned component contracts**

```ts
export type ButtonVariant = "danger" | "icon" | "primary" | "quiet" | "secondary";

export interface UiButtonOptions {
    ariaLabel?: string;
    className?: string;
    icon?: IconRenderer;
    label?: string;
    signal?: AbortSignal;
    tooltip?: string;
    variant: ButtonVariant;
}

export function createUiButton(options: UiButtonOptions): HTMLButtonElement;
```

Keep the current `createButton(label, className)` and `createIconButton(...)` exports until
the later migration packages remove their remaining consumers. `createUiButton` must emit
only `edf-*` classes and use `aria-busy="true"` plus `disabled` for busy actions.

- [ ] **Step 2: Add the anchored popover contract**

```ts
export interface PopoverHandle {
    close(): void;
    element: HTMLElement;
    place(): void;
}

export interface PopoverOptions {
    anchor: HTMLElement;
    content: HTMLElement;
    label: string;
    onClose?(): void;
    signal?: AbortSignal;
}
```

`openPopover` must close an existing owned popover, position above or below the anchor based
on viewport space, clamp horizontally, close on outside pointer/Escape, return focus to the
anchor, and dispose listeners through the supplied signal.

- [ ] **Step 3: Expand tokens and consolidate control CSS**

Add exact token groups for spacing (`4, 8, 12, 16, 24` px), control heights (`36, 40, 44`
px), focus ring (`0 0 0 3px rgb(0 138 8 / 24%)`), motion (`150ms` and `220ms`), and surface
elevation. Define `.edf-ui-button` variants and `.edf-popover`; keep legacy selectors only
while they still have consumers.

- [ ] **Step 4: Register shared CSS on both extension surfaces**

Add `src/shared/ui/popover.css` to the content-script CSS list and import it from
`src/popup/popup.ts`.

- [ ] **Step 5: Verify the foundation task**

Run `npm run typecheck`, `npm run eslint`, and
`npx stylelint "src/app/tokens.css" "src/shared/ui/domainControls.css" "src/shared/ui/popover.css"`.

- [ ] **Step 6: Commit**

```powershell
git add src/app/tokens.css src/shared/ui/elements.ts src/shared/ui/domainControls.css src/shared/ui/popover.ts src/shared/ui/popover.css manifest.config.ts src/popup/popup.ts
git commit -m "refactor: add owned UI primitives"
```

### Task 2: Add a shared replacement-slot lifecycle

**Files:**
- Create: `src/shared/dom/replacement.ts`
- Modify: `src/shared/dom/bodyMutations.ts`
- Modify: `src/shared/dom/ownership.ts`

**Interfaces:**
- Produces: `createReplacementSlot(scope, options): ReplacementSlot`.
- Consumes: existing `LifecycleScope`, `markOwned`, `onBodyMutations`, and `createFrameReconciler`.

- [ ] **Step 1: Define one replacement lifecycle**

```ts
export interface ReplacementTarget {
    host: HTMLElement;
    native?: HTMLElement;
}

export interface ReplacementSlotOptions {
    mount(target: ReplacementTarget, root: HTMLElement): void;
    onError(error: unknown): void;
    owner: string;
    render(root: HTMLElement, target: ReplacementTarget): Promise<void> | void;
    resolve(): ReplacementTarget | undefined;
}

export interface ReplacementSlot {
    schedule(): void;
}

export function createReplacementSlot(
    scope: LifecycleScope,
    options: ReplacementSlotOptions,
): ReplacementSlot;
```

The slot records the native element's `hidden`, `aria-hidden`, and `inert` states, mounts one
owned root, ignores owned-node mutations, and restores the captured state on disposal.

- [ ] **Step 2: Route shared body mutations to slots without rescanning owned subtrees**

Add an exported `hasExternalMutation(mutations)` helper and use `isOwnedNode` consistently.
Do not create an additional document-wide observer.

- [ ] **Step 3: Verify and commit**

Run `npm run typecheck && npm run eslint`, then commit:

```powershell
git add src/shared/dom/replacement.ts src/shared/dom/bodyMutations.ts src/shared/dom/ownership.ts
git commit -m "refactor: centralize replacement lifecycle"
```

### Task 3: Rebuild the shared tooltip

**Files:**
- Modify: `src/shared/ui/tooltip.ts`
- Modify: `src/shared/ui/tooltip.css`
- Modify: `src/shared/ui/elements.ts`

**Interfaces:**
- Produces: `attachTooltip(target, text, options?): TooltipHandle` where options contains
  `placement?: "auto" | "bottom" | "top"` and `signal?: AbortSignal`.

- [ ] **Step 1: Replace fixed top-only placement**

Compute top and bottom candidates from the target rectangle and measured tooltip. Choose the
requested placement when it fits, otherwise flip. Clamp the final left coordinate to 8 px
from the viewport and set `data-placement` for the CSS arrow.

- [ ] **Step 2: Make lifecycle and accessibility deterministic**

Reuse one handle per target, remove stale `aria-describedby`, suppress display for disabled
or `aria-busy` controls, hide on pointerdown, and destroy on the optional abort signal.

- [ ] **Step 3: Apply the Domain-style visual treatment**

Use the shared dark neutral token, 12 px/16 px type, 6 px radius, subtle elevation, a 6 px
CSS arrow, and a short opacity/translate transition disabled by `prefers-reduced-motion`.

- [ ] **Step 4: Verify and commit**

Run `npm run typecheck`, `npm run eslint`, and
`npx stylelint "src/shared/ui/tooltip.css"`, then commit the three files.

### Task 4: Stabilize the popup shell and collection frame

**Files:**
- Create: `src/shared/collections/controller.ts`
- Create: `src/shared/ui/collectionView.ts`
- Modify: `src/shared/ui/collection.css`
- Modify: `src/popup/popup.ts`
- Modify: `src/popup/styles/shell.css`
- Modify: `src/popup/styles/views.css`
- Modify: `src/popup/views/blacklist.ts`
- Modify: `src/popup/views/savedSearches.ts`

**Interfaces:**
- Produces: `createCollectionController(options): CollectionController<TFilter, TItem, TSort>`.
- Produces: `createCollectionFrame(options): CollectionFrame`.
- Produces: `CollectionFrame.replaceCards(cards, animate): void` and
  `CollectionFrame.setToolbar(nodes): void`.

- [ ] **Step 1: Define the shared collection controller**

```ts
export interface CollectionController<TFilter, TItem, TSort> {
    clearSelection(): void;
    getSelection(): ReadonlySet<string>;
    getVisibleItems(): readonly TItem[];
    replaceItems(items: readonly TItem[]): void;
    selectAllVisible(): void;
    setFilter(filter: TFilter): void;
    setSort(sort: TSort): void;
    subscribe(listener: () => void, signal?: AbortSignal): () => void;
    toggleSelection(id: string): void;
}

export interface CollectionControllerOptions<TFilter, TItem, TSort> {
    filter(item: TItem, value: TFilter): boolean;
    getId(item: TItem): string;
    initialFilter: TFilter;
    initialItems: readonly TItem[];
    initialSort: TSort;
    sort(items: readonly TItem[], value: TSort): readonly TItem[];
}
```

The controller owns item replacement, visible-item derivation, filter/sort state, selection
intersection after refresh, select-all-visible, and subscriptions. It contains no DOM and
no saved-search or blacklist knowledge.

- [ ] **Step 2: Define the stable frame**

```ts
export interface CollectionFrame {
    element: HTMLElement;
    replaceCards(cards: readonly Node[], animate?: boolean): void;
    setEmptyState(empty?: HTMLElement): void;
    setToolbar(nodes: readonly Node[]): void;
}
```

The frame contains fixed `toolbar` and scrollable `cards` regions. Card replacement may
apply opacity only to the cards region.

- [ ] **Step 3: Keep popup shell/navigation mounted across view changes**

Create the shell once, retain the navigation row, and replace only the content host.
Abort the previous view scope without recreating the shell. Preserve the originating view
for the later login flow.

- [ ] **Step 4: Migrate both popup collections to the shared system**

Build the same toolbar order for My Searches and Blacklist: tabs, selection actions, sort.
Back each view with `createCollectionController`, render it through `CollectionFrame`, and
remove `.edf-popup-view` and `edf-popup-view-enter` vertical animation.

- [ ] **Step 5: Manually verify toolbar geometry and state**

Load `dist`, alternate My Searches and Blacklist at least ten times, and confirm the toolbar
top/left coordinates do not change when both views contain data. Repeat with empty states,
filter/sort changes, single selection, select all, and refresh after deletion.

- [ ] **Step 6: Verify and commit**

Run `npm run check:all`, then commit the controller, frame, and popup migration.

### Task 5: Replace cloned blacklist buttons with one owned action

**Files:**
- Create: `src/features/listing-cards/actions/blacklistAction.ts`
- Modify: `src/features/listing-cards/styles.css`
- Modify: `src/features/listing-cards/bind.ts`
- Modify: `src/features/listing-cards/blacklist/toggle.ts`
- Modify: `src/features/listing-cards/cards/project.ts`
- Modify: `src/features/listing-cards/cards/carousel.ts`
- Modify: `src/pages/listing.ts`
- Modify: `src/pages/shortlist.ts`
- Delete after migration: `src/features/listing-cards/clone/blacklistButton.ts`

**Interfaces:**
- Produces: `createBlacklistAction(options): HTMLButtonElement`.
- Produces: `setBlacklistActionState(button, state): void`.

- [ ] **Step 1: Define context-independent action state**

```ts
export type BlacklistActionAppearance = "card" | "carousel" | "listing-detail" | "project" | "shortlist";

export interface BlacklistActionState {
    active: boolean;
    busy?: boolean;
    label?: string;
}

export interface BlacklistActionOptions extends BlacklistActionState {
    appearance: BlacklistActionAppearance;
    onToggle(button: HTMLButtonElement): Promise<void> | void;
    signal: AbortSignal;
}
```

The component always uses owned markup, bin/unbin icons, `aria-pressed`, the shared tooltip,
and appearance classes. It never accepts a Domain node or class string.

- [ ] **Step 2: Migrate standard, shortlist, project, and carousel consumers**

Adapters may locate insertion slots, but all rendering and state comes from the new action.
Preserve removal from Domain shortlist when a listing is blacklisted.

- [ ] **Step 3: Rebuild listing-detail styling independently**

Mount the `listing-detail` appearance into the semantic CTA container. Define its complete
border, background, size, color, focus, active, and busy styles without selectors that
reference Domain button classes.

- [ ] **Step 4: Delete the clone module and CSS-hash skins**

Remove all imports and confirm:

```powershell
rg -n "cloneBlacklistButton|KNOWN_INACTIVE|css-11t19a7|css-bhcn0k|css-9xfbzc|css-1m4oqag|css-zwjexa" src
```

Expected: no matches.

- [ ] **Step 5: Verify and commit**

Run `npm run check:all && npm run build`. Manually toggle blacklist state on a search card,
project, featured carousel, shortlist card, and listing-detail route, then commit.

### Task 6: Rebuild Domain navbar chevron state

**Files:**
- Create: `src/shared/domain/navigation.ts`
- Modify: `src/features/navigation/index.ts`
- Modify: `src/features/navigation/styles.css`

**Interfaces:**
- Produces: `findNavigationMenus(): NavigationMenuBinding[]`.
- Produces: `observeNavigationMenu(binding, onChange, signal): void`.

- [ ] **Step 1: Pair semantic triggers and menus**

```ts
export interface NavigationMenuBinding {
    carrier: HTMLElement;
    chevron: SVGElement;
    isOpen(): boolean;
    menu?: HTMLElement;
    trigger: HTMLElement;
}
```

Use `aria-controls` first, then the closest semantic menu container and accessible trigger
name. Do not identify the chevron by `.css-1ohxmtf`.

- [ ] **Step 2: Remove the speculative click state machine**

Delete `openDesktopMenu`, `accountMenuOpen`, pointerdown toggles, and document-level forced
closing. Observe `aria-expanded`, native open attributes, and paired-menu connection/style.

- [ ] **Step 3: Reset the animation foundation**

Closed uses `transform: rotate(0deg)` and open uses `rotate(180deg)` on one owned state
attribute. Set `data-edf-navigation-ready="true"` only after the first synchronized frame.
Disable the transition before readiness and under reduced motion.

- [ ] **Step 4: Verify and commit**

Run `npm run check:all && npm run build`. Manually verify mouse, Enter/Space, Escape,
outside-click, switching between menus, and back/forward navigation, then commit.

### Task 7: Package 1 final verification

**Files:**
- Modify only if verification finds a package-1 regression.

- [ ] **Step 1: Run full static and build checks**

Run `npm run check:all && npm run build` and require exit code 0.

- [ ] **Step 2: Run the package manual matrix**

Verify tooltip collision/focus/reduced motion, stable popup toolbar, all blacklist action
placements, listing-detail independence after removing Domain classes in DevTools, and all
navbar open/close paths.

- [ ] **Step 3: Search for forbidden dependencies**

Run the clone/hash search from Task 5 and
`rg -n "\.css-1ohxmtf|openDesktopMenu|accountMenuOpen|edf-popup-view-enter" src`.
Expected: no matches.

- [ ] **Step 4: Record the verified commit**

Commit only verification fixes with `git commit -m "fix: verify owned UI foundation"`.
