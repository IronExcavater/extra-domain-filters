# Code Quality Cleanup Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Fix the duplication, global monkey-patching, unnamed magic numbers, dead code, and naming inconsistency found by a three-part codebase audit, without changing observable behavior (except the two places that were latent bugs: the `toTitleCase` naming collision and the `console.warn`-bypasses-log-level issue).

**Architecture:** Each task is an independent, self-contained fix verified by `tsc`/`eslint`/`stylelint` before moving to the next. No task depends on another's code changes except where explicitly noted (Task 5 and Task 9 both touch `pages/shortlist.ts` — Task 9 assumes Task 5 already landed).

**Tech Stack:** TypeScript, Vite, Chrome extension (MV3). New dependency: `p-queue`.

## Global Constraints

- No behavioural change except: the `toTitleCase`/`slugToTitleCase` split (was silently using two different algorithms depending on file — now explicit) and sync-failure logging moving from `console.warn` to the existing `createLogger` (visibility improvement, not a behavior change to the sync logic itself).
- `npm run check:all` clean after every task.
- Manual UI check after Task 1: saved-search summary labels (property type / suburb, e.g. "Inner West") must render identically to before.

---

## Task 1: Remove global monkey-patching (Math/String prototype extensions)

**Files:**
- Delete: `src/apps/extension/utils/math.extensions.ts`
- Modify: `src/apps/extension/utils/string.extensions.ts` → rename to `src/apps/extension/utils/string.ts`, convert to plain exports, drop the unused `toSentenceCase`
- Modify: `src/apps/extension/content/main.ts` (remove side-effect imports)
- Modify: `src/apps/extension/platform/logging.ts` (use the plain function)
- Modify: `src/apps/extension/features/saved-searches/card/summary.ts` (rename local function to avoid the name collision)

**Interfaces:**
- Produces: `utils/string.ts` exports `toTitleCase(value: string): string`.

- [ ] **Step 1: Delete the dead Math extension file**

```bash
rm src/apps/extension/utils/math.extensions.ts
```

(Confirmed zero callers of `Math.clamp`/`Math.percent` anywhere in the codebase.)

- [ ] **Step 2: Convert string.extensions.ts to a plain-export string.ts**

```bash
git mv src/apps/extension/utils/string.extensions.ts src/apps/extension/utils/string.ts
```

Replace the full content of `src/apps/extension/utils/string.ts` with:

```ts
export function toTitleCase(value: string): string {
    return value.toLowerCase().replace(/(^|[^\p{L}\p{N}])(\p{L})/gu, (_, separator, letter) => {
        return separator + letter.toUpperCase();
    });
}
```

(`toSentenceCase` is dropped — it was defined but had zero callers anywhere in the codebase.)

- [ ] **Step 3: Remove the side-effect imports in content/main.ts**

Change:
```ts
import "../utils/string.extensions";
import "../utils/math.extensions";

import { trackTelemetry } from "../domain/telemetry/client";
```
to:
```ts
import { trackTelemetry } from "../domain/telemetry/client";
```

- [ ] **Step 4: Update logging.ts to call the plain function**

Change:
```ts
import type { LogLevel... // (whatever the existing top-of-file imports are — there are none currently)
```
Add an import and change the call site. In `src/apps/extension/platform/logging.ts`, add at the top of the file (before the existing `export type LogLevel` line):
```ts
import { toTitleCase } from "../utils/string";

```
Change:
```ts
    const prefix = `[${scope.toTitleCase()}]`;
```
to:
```ts
    const prefix = `[${toTitleCase(scope)}]`;
```

- [ ] **Step 5: Rename the local title-case function in summary.ts to stop the name collision**

In `src/apps/extension/features/saved-searches/card/summary.ts`, change:
```ts
function toTitleCase(value: string): string {
    return value
        .replace(/[+/_-]+/g, " ")
        .split(/\s+/)
        .filter(Boolean)
        .map(word => word[0].toUpperCase() + word.slice(1).toLowerCase())
        .join(" ");
}
```
to:
```ts
function slugToTitleCase(value: string): string {
    return value
        .replace(/[+/_-]+/g, " ")
        .split(/\s+/)
        .filter(Boolean)
        .map(word => word[0].toUpperCase() + word.slice(1).toLowerCase())
        .join(" ");
}
```
Then update its one call site in the same file (inside `formatList`, currently `.map(toTitleCase)`) to `.map(slugToTitleCase)`.

- [ ] **Step 6: Verify**

```bash
npx tsc --noEmit
npm run eslint
```

Expected: clean. Fix any remaining references to the deleted `.toTitleCase()`/`.toSentenceCase()` prototype methods or the deleted `math.extensions`/`string.extensions` module paths.

- [ ] **Step 7: Commit**

```bash
git add -A
git commit -m "refactor: drop Math/String prototype monkey-patching for plain functions"
```

---

## Task 2: Replace the 4x-duplicated sync queue with p-queue

**Files:**
- Modify: `package.json` (add `p-queue` dependency)
- Modify: `src/apps/extension/background/blacklistSync.ts`
- Modify: `src/apps/extension/background/savedSearchSync.ts`
- Modify: `src/apps/extension/background/settingsSync.ts`
- Modify: `src/apps/extension/background/telemetry.ts`

**Interfaces:**
- Consumes: `createLogger` from `../platform/logging` (already exists).

- [ ] **Step 1: Add the p-queue dependency**

```bash
npm install p-queue
```

- [ ] **Step 2: Migrate blacklistSync.ts**

Add to the top imports (after the existing `import { getFirebaseServices } from "../infrastructure/firebase/client";` block, before `createStorageRepository`):
```ts
import PQueue from "p-queue";

import { createLogger } from "../platform/logging";
```

Change:
```ts
let ignoredBlacklist = "";
let syncQueue = Promise.resolve();
```
to:
```ts
const logger = createLogger("Blacklist Sync");
let ignoredBlacklist = "";
const syncQueue = new PQueue({ concurrency: 1 });
```

Change:
```ts
export function requestBlacklistSync(): Promise<void> {
    const operation = syncQueue.then(synchronize);
    syncQueue = operation.catch(() => undefined);
    return operation;
}
```
to:
```ts
export function requestBlacklistSync(): Promise<void> {
    return syncQueue.add(() => synchronize());
}
```

Change:
```ts
        void recordLocalChange(next, previous ?? [])
            .then(requestBlacklistSync)
            .catch(error => console.warn("[Extra Domain Filters] Blacklist sync failed", error));
```
to:
```ts
        void recordLocalChange(next, previous ?? [])
            .then(requestBlacklistSync)
            .catch(error => logger.warn("Blacklist sync failed", error));
```

- [ ] **Step 3: Migrate savedSearchSync.ts**

Add to the top imports (after the `getFirebaseServices` import block):
```ts
import PQueue from "p-queue";

import { createLogger } from "../platform/logging";
```

Change:
```ts
let ignoredSearches = "";
let syncQueue = Promise.resolve();
```
to:
```ts
const logger = createLogger("Saved Search Sync");
let ignoredSearches = "";
const syncQueue = new PQueue({ concurrency: 1 });
```

Change:
```ts
export function requestSavedSearchSync(): Promise<void> {
    const operation = syncQueue.then(synchronize);
    syncQueue = operation.catch(() => undefined);
    return operation;
}
```
to:
```ts
export function requestSavedSearchSync(): Promise<void> {
    return syncQueue.add(() => synchronize());
}
```

Change:
```ts
        void recordLocalChange(next, previous ?? [])
            .then(requestSavedSearchSync)
            .catch(error => console.warn("[Extra Domain Filters] Saved search sync failed", error));
```
to:
```ts
        void recordLocalChange(next, previous ?? [])
            .then(requestSavedSearchSync)
            .catch(error => logger.warn("Saved search sync failed", error));
```

- [ ] **Step 4: Migrate settingsSync.ts**

Add to the top imports (after the `getFirebaseServices` import):
```ts
import PQueue from "p-queue";

import { createLogger } from "../platform/logging";
```

Change:
```ts
let ignoredSettings = "";
let syncQueue = Promise.resolve();
```
to:
```ts
const logger = createLogger("Settings Sync");
let ignoredSettings = "";
const syncQueue = new PQueue({ concurrency: 1 });
```

Change:
```ts
export function requestSettingsSync(): Promise<void> {
    const operation = syncQueue.then(synchronize);
    syncQueue = operation.catch(() => undefined);
    return operation;
}
```
to:
```ts
export function requestSettingsSync(): Promise<void> {
    return syncQueue.add(() => synchronize());
}
```

Change:
```ts
        void recordLocalChange(next, previous ?? DEFAULT_SETTINGS)
            .then(requestSettingsSync)
            .catch(error => console.warn("[Extra Domain Filters] Settings sync failed", error));
```
to:
```ts
        void recordLocalChange(next, previous ?? DEFAULT_SETTINGS)
            .then(requestSettingsSync)
            .catch(error => logger.warn("Settings sync failed", error));
```

- [ ] **Step 5: Migrate telemetry.ts**

Add to the top imports (after the `getFirebaseServices` import):
```ts
import PQueue from "p-queue";

import { createLogger } from "../platform/logging";
```

Change:
```ts
let flushQueue = Promise.resolve();
```
to:
```ts
const logger = createLogger("Telemetry");
const flushQueue = new PQueue({ concurrency: 1 });
```

Change:
```ts
export function requestTelemetryFlush(): Promise<void> {
    const operation = flushQueue.then(flush);
    flushQueue = operation.catch(() => undefined);
    return operation;
}
```
to:
```ts
export function requestTelemetryFlush(): Promise<void> {
    return flushQueue.add(() => flush());
}
```

(`telemetry.ts` has no `console.warn` sync-failure site to migrate — its `trackTelemetry`/`flush` don't currently log failures at all; that's covered separately if needed, out of scope here since the audit didn't flag a specific silent-swallow line in this file beyond what Task 10 covers elsewhere.)

- [ ] **Step 6: Verify**

```bash
npx tsc --noEmit
npm run eslint
```

Expected: clean.

- [ ] **Step 7: Commit**

```bash
git add -A
git commit -m "refactor: replace hand-rolled sync queues with p-queue"
```

---

## Task 3: Consolidate the 3 real waitForElement duplicates

**Note:** Of the 4 implementations the audit found, only 3 are actually the same abstraction (`dom/wait.ts`, `content/main.ts`'s `waitForDomainElement`, `site-dom/alerts.ts`'s `waitFor`) — all three are "poll via MutationObserver until a value appears, with abort/timeout." `dom/trigger.ts`'s `waitForTarget` is a genuinely different, event-driven trigger-binding pattern (callback-based, not promise-based, with its own single-flight guard) and is **not** touched by this task.

**Files:**
- Modify: `src/apps/extension/dom/wait.ts` (extend with options)
- Modify: `src/apps/extension/content/main.ts` (use shared helper, delete local one)
- Modify: `src/apps/extension/site-dom/alerts.ts` (use shared helper, delete local one)

**Interfaces:**
- Produces: `waitForElement<T>(find: () => T | undefined, signal: AbortSignal, options?: WaitForElementOptions): Promise<T>` where `WaitForElementOptions = { observe?: MutationObserverInit; root?: Node; timeoutMessage?: string; timeoutMs?: number }`.

- [ ] **Step 1: Extend dom/wait.ts with options support**

Replace the full content of `src/apps/extension/dom/wait.ts` with:

```ts
export interface WaitForElementOptions {
    observe?: MutationObserverInit;
    root?: Node;
    timeoutMessage?: string;
    timeoutMs?: number;
}

export function waitForElement<T>(
    find: () => T | undefined,
    signal: AbortSignal,
    options: WaitForElementOptions = {},
): Promise<T> {
    const {
        observe = { childList: true, subtree: true },
        root = document.body,
        timeoutMessage,
        timeoutMs,
    } = options;

    if (signal.aborted) {
        return Promise.reject(new DOMException("Unmounted", "AbortError"));
    }

    const existing = find();
    if (existing) return Promise.resolve(existing);

    return new Promise((resolve, reject) => {
        let settled = false;
        const cleanup = (): void => {
            observer.disconnect();
            if (timeout !== undefined) window.clearTimeout(timeout);
            signal.removeEventListener("abort", onAbort);
        };
        const onAbort = (): void => {
            if (settled) return;
            settled = true;
            cleanup();
            reject(new DOMException("Unmounted", "AbortError"));
        };
        const observer = new MutationObserver(() => {
            const element = find();
            if (!element || settled) return;
            settled = true;
            cleanup();
            resolve(element);
        });
        const timeout = timeoutMs !== undefined
            ? window.setTimeout(() => {
                if (settled) return;
                settled = true;
                cleanup();
                reject(timeoutMessage ? new Error(timeoutMessage) : new DOMException("Timed out", "TimeoutError"));
            }, timeoutMs)
            : undefined;
        observer.observe(root, observe);
        signal.addEventListener("abort", onAbort, { once: true });
    });
}
```

(The two existing callers — `features/user-listings/page.ts:15` and `features/settings/profile.ts:67` — call `waitForElement(fn, signal)` with no third argument, so they're unaffected by this signature change.)

- [ ] **Step 2: Migrate content/main.ts**

Remove the local `waitForDomainElement` function entirely (lines defining it, from `function waitForDomainElement<T extends HTMLElement>(` through its closing `}`).

Add an import (alongside the existing `../dom/` style imports — there are none yet in this file, so add near the top with the other relative imports):
```ts
import { waitForElement } from "../dom/wait";
```

Change the two call sites inside the `chrome.runtime.onMessage` handler from:
```ts
    const operation: Promise<DomainPageResult> = isDomainAlertApplyMessage(message)
        ? waitForDomainElement(() => message.domainId
            ? findDomainSavedSearchAlertTrigger(message.domainId)
            : document.querySelector<HTMLButtonElement>('button[name="property-alert"]') ?? undefined,
        controller.signal).then(trigger => domainAlertBridge.apply({
                frequency: message.frequency,
                signal: controller.signal,
                trigger,
            }))
        : waitForDomainElement(() => findDomainSavedSearchEntry(message.domainId), controller.signal)
            .then(async () => {
                await removeDomainSavedSearch(message.domainId);
                return { ok: true };
            });
```
to:
```ts
    const operation: Promise<DomainPageResult> = isDomainAlertApplyMessage(message)
        ? waitForElement(() => message.domainId
            ? findDomainSavedSearchAlertTrigger(message.domainId)
            : document.querySelector<HTMLButtonElement>('button[name="property-alert"]') ?? undefined,
        controller.signal, {
            timeoutMessage: "Domain's alert control is unavailable.",
            timeoutMs: 10_000,
        }).then(trigger => domainAlertBridge.apply({
                frequency: message.frequency,
                signal: controller.signal,
                trigger,
            }))
        : waitForElement(() => findDomainSavedSearchEntry(message.domainId), controller.signal, {
            timeoutMessage: "Domain's saved search entry is unavailable.",
            timeoutMs: 10_000,
        })
            .then(async () => {
                await removeDomainSavedSearch(message.domainId);
                return { ok: true };
            });
```

(Note: the saved-search-removal path previously reused the alert-control's error message verbatim — this gives it its own correct message, a small precision fix alongside the consolidation.)

- [ ] **Step 3: Migrate site-dom/alerts.ts**

Remove the local `waitFor` function entirely (from `function waitFor<T>(` through its closing `}`).

Add an import near the top of the file (after the existing `import type { DomainPageFailure, DomainPageResult } from "./action";`):
```ts
import { waitForElement } from "../dom/wait";
```

Add a module-level constant near `FORM_TIMEOUT_MS`:
```ts
const FORM_TIMEOUT_MS = 4_000;
const ALERT_OBSERVE_OPTIONS: MutationObserverInit = {
    attributes: true,
    characterData: true,
    childList: true,
    subtree: true,
};
```

Update the 3 call sites (all previously used the default `timeoutMs = FORM_TIMEOUT_MS`):

Change:
```ts
    const option = await waitFor(() =>
        [...document.querySelectorAll<HTMLElement>('[role="option"]')]
            .find(candidate => pattern.test(candidate.textContent?.trim() ?? "")), signal);
```
to:
```ts
    const option = await waitForElement(() =>
        [...document.querySelectorAll<HTMLElement>('[role="option"]')]
            .find(candidate => pattern.test(candidate.textContent?.trim() ?? "")), signal,
        { observe: ALERT_OBSERVE_OPTIONS, timeoutMs: FORM_TIMEOUT_MS });
```

Change:
```ts
            const form = await waitFor(findAlertForm, request.signal);
```
to:
```ts
            const form = await waitForElement(findAlertForm, request.signal,
                { observe: ALERT_OBSERVE_OPTIONS, timeoutMs: FORM_TIMEOUT_MS });
```

Change:
```ts
            await waitFor(() => form.isConnected ? undefined : true, request.signal);
```
to:
```ts
            await waitForElement(() => form.isConnected ? undefined : true, request.signal,
                { observe: ALERT_OBSERVE_OPTIONS, timeoutMs: FORM_TIMEOUT_MS });
```

- [ ] **Step 4: Verify**

```bash
npx tsc --noEmit
npm run eslint
```

Expected: clean.

- [ ] **Step 5: Commit**

```bash
git add -A
git commit -m "refactor: consolidate 3 waitForElement implementations into dom/wait.ts"
```

---

## Task 4: Fix the normalizeUrl naming collision

**Files:**
- Modify: `src/apps/extension/background/blacklistSync.ts`
- Modify: `src/apps/extension/domain/matching/index.ts`
- Modify: `src/apps/extension/domain/searches/recentSearches.ts`

**Interfaces:**
- Consumes: `normalizeListingUrl` from `../domain/listings/url` (already exists, unchanged).

- [ ] **Step 1: blacklistSync.ts — remove the local duplicate**

Add to the imports (alongside the existing `../domain/...` imports):
```ts
import { normalizeListingUrl } from "../domain/listings/url";
```

Remove:
```ts
function normalizeUrl(url: string): string {
    return url.replace(/\/+$/, "");
}
```

Replace every call to `normalizeUrl(...)` in this file with `normalizeListingUrl(...)` (occurs in `fingerprint`, `normalizeBlacklistSyncValue`, `getRecordId`, `seedRecords`, `recordLocalChange`, `materializeBlacklist` — every call site in the file).

- [ ] **Step 2: domain/matching/index.ts — remove the local duplicate**

Add to the imports:
```ts
import { normalizeListingUrl } from "../listings/url";
```

Remove:
```ts
function normalizeUrl(url: string): string {
    return url.replace(/\/+$/, "");
}
```

Change:
```ts
function hasUrl(entry: BlacklistEntry, url: string): boolean {
    return normalizeUrl(entry.url) === normalizeUrl(url);
}
```
to:
```ts
function hasUrl(entry: BlacklistEntry, url: string): boolean {
    return normalizeListingUrl(entry.url) === normalizeListingUrl(url);
}
```

- [ ] **Step 3: recentSearches.ts — rename the unrelated function**

This function does something entirely different (query-param canonicalization, not trailing-slash stripping) — rename it so it no longer collides with `normalizeListingUrl`'s concept.

Change:
```ts
function normalizeUrl(value: string, includeCustomFilters: boolean): string | undefined {
```
to:
```ts
function normalizeSearchUrl(value: string, includeCustomFilters: boolean): string | undefined {
```

Update its 3 call sites in the same file (search for `normalizeUrl(` — there are 3: inside the function that builds a recent-search record, inside a lookup function, and inside a third helper) to `normalizeSearchUrl(`.

- [ ] **Step 4: Verify**

```bash
npx tsc --noEmit
npm run eslint
```

Expected: clean.

- [ ] **Step 5: Commit**

```bash
git add -A
git commit -m "refactor: fix normalizeUrl naming collision across 3 files"
```

---

## Task 5: Dedupe installSortControl and the DOM selector constants

**Files:**
- Modify: `src/apps/extension/features/user-listings/page.ts` (add shared `installSortControl`, export selector constants)
- Modify: `src/apps/extension/pages/shortlist.ts` (use shared `installSortControl`, import shared selectors)
- Modify: `src/apps/extension/pages/blacklist.ts` (use shared `installSortControl`, import shared selector)
- Modify: `src/apps/extension/features/listing-cards/dom/card.ts` (export the selector)
- Modify: `src/apps/extension/features/listing-cards/exclusion/row.ts` (export the selector)
- Modify: `src/apps/extension/features/listing-cards/exclusion/compact.ts` (import instead of re-declaring)

**Interfaces:**
- Produces (in `features/user-listings/page.ts`): `installSortControl<TValue extends string>(container: HTMLElement, options: SortControlOptions<TValue>): () => void` where `SortControlOptions<TValue> = { actionsTestId: string; ariaLabel: string; onChange: (value: TValue, nativeSort: HTMLElement | undefined) => void; options: ReadonlyArray<readonly [TValue, string]>; signal: AbortSignal }`. Also exports `LISTING_CARD_SELECTOR` and `SORT_SELECTOR` (already defined there, just not exported today).

- [ ] **Step 1: Export the existing constants and add the shared installSortControl to features/user-listings/page.ts**

Change:
```ts
import { waitForElement } from "../../dom/wait";

const SHORTLIST_ROOT_SELECTOR = "#shortlist";
const LISTING_CARD_SELECTOR = '[data-testid="listing-card-container"]';
const SORT_SELECTOR = '[data-testid="listing-tabs__filters-sort-by"]';
```
to:
```ts
import { markOwned } from "../../dom/ownership";
import { waitForElement } from "../../dom/wait";
import { createSortControl } from "../../ui/sort";

const SHORTLIST_ROOT_SELECTOR = "#shortlist";
export const LISTING_CARD_SELECTOR = '[data-testid="listing-card-container"]';
export const SORT_SELECTOR = '[data-testid="listing-tabs__filters-sort-by"]';
```

Add this new exported function at the end of the file (after `replaceUserListingTabs`):
```ts
export interface SortControlOptions<TValue extends string> {
    actionsTestId: string;
    ariaLabel: string;
    onChange: (value: TValue, nativeSort: HTMLElement | undefined) => void;
    options: ReadonlyArray<readonly [TValue, string]>;
    signal: AbortSignal;
}

export function installSortControl<TValue extends string>(
    container: HTMLElement,
    options: SortControlOptions<TValue>,
): () => void {
    const nativeSort = container.querySelector<HTMLElement>(SORT_SELECTOR);
    const actions = container.querySelector<HTMLElement>(`[data-testid="${options.actionsTestId}"]`);
    const filterGroup = actions?.querySelector<HTMLElement>(".edf-control-group:last-child");
    const nativeLabel = actions?.querySelector<HTMLElement>('[data-edf-sort-label="true"]');
    if (!filterGroup) return () => undefined;

    const sort = createSortControl({
        ariaLabel: options.ariaLabel,
        onChange: () => options.onChange(sort.value() as TValue, nativeSort ?? undefined),
        options: options.options,
        signal: options.signal,
    });

    if (nativeSort) nativeSort.hidden = true;
    if (nativeLabel) nativeLabel.hidden = true;
    filterGroup.append(markOwned(sort.element, "sort-control"));

    return () => {
        if (nativeSort) nativeSort.hidden = false;
        if (nativeLabel) nativeLabel.hidden = false;
        sort.element.remove();
    };
}
```

- [ ] **Step 2: Update shortlist.ts to use the shared installSortControl**

Change the import:
```ts
import {
    findUserListingsContainer,
    getPageActions,
    getUserListingCards,
    getUserListingUrl,
    getUserListingUrls,
    replaceUserListingTabs,
} from "../features/user-listings/page";
```
to:
```ts
import {
    findUserListingsContainer,
    getPageActions,
    getUserListingCards,
    getUserListingUrl,
    getUserListingUrls,
    installSortControl,
    replaceUserListingTabs,
} from "../features/user-listings/page";
```

Remove the local `installSortControl` function entirely (keep `chooseNativeSort` — it stays local, it's specific to this page's native-dropdown-clicking behavior):
```ts
function installSortControl(container: HTMLElement, signal: AbortSignal): () => void {
    const nativeSort = container.querySelector<HTMLElement>('[data-testid="listing-tabs__filters-sort-by"]');
    const actions = container.querySelector<HTMLElement>('[data-testid="extra-domain-filters-shortlist-sort-actions"]');
    const filterGroup = actions?.querySelector<HTMLElement>(".edf-control-group:last-child");
    const nativeLabel = actions?.querySelector<HTMLElement>('[data-edf-sort-label="true"]');
    if (!nativeSort || !filterGroup) return () => undefined;

    const sort = createSortControl({
        ariaLabel: "Sort shortlisted properties",
        onChange: () => chooseNativeSort(nativeSort, sort.value()),
        options: [
            ["Date shortlisted", "Date shortlisted"],
            ["Newest", "Newest"],
            ["Lowest price", "Lowest price"],
            ["Highest price", "Highest price"],
            ["Earliest inspection", "Earliest inspection"],
            ["Suburb", "Suburb"],
        ],
        signal,
    });

    nativeSort.hidden = true;
    if (nativeLabel) nativeLabel.hidden = true;
    filterGroup.append(sort.element);

    return () => {
        nativeSort.hidden = false;
        if (nativeLabel) nativeLabel.hidden = false;
        sort.element.remove();
    };
}
```

Change the call site:
```ts
        const restoreSort = installSortControl(container, context.signal);
```
to:
```ts
        const restoreSort = installSortControl(container, {
            actionsTestId: "extra-domain-filters-shortlist-sort-actions",
            ariaLabel: "Sort shortlisted properties",
            onChange: (value, nativeSort) => {
                if (nativeSort) chooseNativeSort(nativeSort, value);
            },
            options: [
                ["Date shortlisted", "Date shortlisted"],
                ["Newest", "Newest"],
                ["Lowest price", "Lowest price"],
                ["Highest price", "Highest price"],
                ["Earliest inspection", "Earliest inspection"],
                ["Suburb", "Suburb"],
            ],
            signal: context.signal,
        });
```

Since `createSortControl` is no longer called directly in this file, remove its now-unused import:
```ts
import { createSortControl } from "../ui/sort";
```
(delete this line — check it isn't used elsewhere in the file first; it was only used by the now-removed local `installSortControl`).

- [ ] **Step 3: Update blacklist.ts to use the shared installSortControl**

Change the import:
```ts
import {
    getPageActions,
    overridePageTitle,
    replaceUserListingTabs,
    restorePageActions,
    waitForUserListingsContainer,
} from "../features/user-listings/page";
```
to:
```ts
import {
    getPageActions,
    installSortControl,
    LISTING_CARD_SELECTOR,
    overridePageTitle,
    replaceUserListingTabs,
    restorePageActions,
    waitForUserListingsContainer,
} from "../features/user-listings/page";
```

Remove the local `installSortControl` function entirely:
```ts
function installSortControl(
    container: HTMLElement,
    renderRows: () => void,
    signal: AbortSignal,
): () => void {
    const nativeSort = container.querySelector<HTMLElement>(
        '[data-testid="listing-tabs__filters-sort-by"]',
    );
    const sortActions = container.querySelector<HTMLElement>(
        '[data-testid="extra-domain-filters-blacklist-sort-actions"]',
    );
    const filterGroup = sortActions?.querySelector<HTMLElement>(".edf-control-group:last-child");
    const nativeLabel = sortActions?.querySelector<HTMLElement>('[data-edf-sort-label="true"]');
    if (!filterGroup) return () => undefined;

    const sort = createSortControl({
        ariaLabel: "Sort blacklisted properties",
        onChange: () => {
            listingSort = sort.value() as BlacklistSort;
            renderRows();
        },
        options: [
            ["newest", "Newest"],
            ["oldest", "Oldest"],
            ["price-asc", "Lowest price"],
            ["price-desc", "Highest price"],
        ],
        signal,
    });

    if (nativeSort) nativeSort.hidden = true;
    if (nativeLabel) nativeLabel.hidden = true;
    filterGroup.append(markOwned(sort.element, "blacklist-sort"));

    return () => {
        if (nativeSort) nativeSort.hidden = false;
        if (nativeLabel) nativeLabel.hidden = false;
        sort.element.remove();
    };
}
```

Change the inline selector literal:
```ts
    const nativeList = container
        .querySelector('[data-testid="listing-card-container"]')
        ?.parentElement;
```
to:
```ts
    const nativeList = container
        .querySelector(LISTING_CARD_SELECTOR)
        ?.parentElement;
```

Change the call site:
```ts
    const restoreSort = installSortControl(container, renderRows, context.signal);
```
to:
```ts
    const restoreSort = installSortControl(container, {
        actionsTestId: "extra-domain-filters-blacklist-sort-actions",
        ariaLabel: "Sort blacklisted properties",
        onChange: value => {
            listingSort = value as BlacklistSort;
            renderRows();
        },
        options: [
            ["newest", "Newest"],
            ["oldest", "Oldest"],
            ["price-asc", "Lowest price"],
            ["price-desc", "Highest price"],
        ],
        signal: context.signal,
    });
```

Since `createSortControl` and `markOwned` are no longer called directly in this file (both only used by the now-removed local `installSortControl`), remove their now-unused imports:
```ts
import { markOwned } from "../dom/ownership";
```
```ts
import { createSortControl } from "../ui/sort";
```
(delete both lines — verify neither is used elsewhere in the file first.)

- [ ] **Step 4: Export and reuse the exclusion-row selector**

In `src/apps/extension/features/listing-cards/exclusion/row.ts`, change:
```ts
const ROW_SELECTOR = '[data-testid="listing-card-exclusion-row"]';
```
to:
```ts
export const ROW_SELECTOR = '[data-testid="listing-card-exclusion-row"]';
```

In `src/apps/extension/features/listing-cards/exclusion/compact.ts`, change:
```ts
import { getBlacklistCardKind, getTitle, TOP_LEVEL_CARD_SELECTOR } from "../dom/card";
import { resolveExclusionAction } from "./row";
```
to:
```ts
import { getBlacklistCardKind, getTitle, TOP_LEVEL_CARD_SELECTOR } from "../dom/card";
import { resolveExclusionAction, ROW_SELECTOR } from "./row";
```

Remove the local duplicate:
```ts
const ROW_SELECTOR = '[data-testid="listing-card-exclusion-row"]';
```

- [ ] **Step 5: Export the listing-card-container selector for dom/card.ts consumers**

In `src/apps/extension/features/listing-cards/dom/card.ts`, change:
```ts
const LISTING_CARD_CONTAINER_SELECTOR = '[data-testid="listing-card-container"]';
```
to:
```ts
export const LISTING_CARD_CONTAINER_SELECTOR = '[data-testid="listing-card-container"]';
```

(This is a separate, already-correctly-scoped selector from `features/user-listings/page.ts`'s `LISTING_CARD_SELECTOR` — both target the same `data-testid`, kept as two exports since they're consumed by different feature areas today; no further consolidation needed beyond making both properly exported/imported instead of re-declared.)

- [ ] **Step 6: Verify**

```bash
npx tsc --noEmit
npm run eslint
```

Expected: clean. Watch for unused-import errors if any of the removed imports (`createSortControl`, `markOwned` in blacklist.ts/shortlist.ts) turn out to still be needed elsewhere in those files — if eslint flags them as unused, that confirms the removal was correct; if it flags them as missing, re-check whether another usage remains.

- [ ] **Step 7: Commit**

```bash
git add -A
git commit -m "refactor: dedupe installSortControl and listing-card selector constants"
```

---

## Task 6: Name and single-source the magic numbers

**Files:**
- Modify: `src/shared/config/auth.ts` (export the dev bridge URL)
- Modify: `vite.auth.config.ts` (derive port from it)
- Modify: `manifest.config.ts` (single domain-match-pattern constant)
- Modify: `src/apps/site/content.ts` (email interpolation)
- Modify: `src/apps/extension/offscreen/offscreen.ts` (named timeout)
- Modify: `src/apps/extension/background/telemetry.ts` (named batch size)
- Modify: `src/apps/extension/dom/bodyMutations.ts` (shared debounce constant)
- Modify: `src/apps/extension/pages/shortlist.ts` (use shared debounce constant, 2 sites)
- Modify: `src/apps/extension/features/listing-cards/index.ts` (use shared debounce constant)
- Modify: `src/apps/extension/features/map/pins.ts` (use shared debounce constant)
- Modify: `src/apps/extension/features/map/calibration.ts` (named thresholds)
- Modify: `src/apps/extension/platform/domainPageClient.ts` (named retry constants)

- [ ] **Step 1: Export the dev bridge URL and derive the Vite port from it**

In `src/shared/config/auth.ts`, change:
```ts
const DEVELOPMENT_BRIDGE_URL = "http://127.0.0.1:5174/auth/";
```
to:
```ts
export const DEVELOPMENT_BRIDGE_URL = "http://127.0.0.1:5174/auth/";
```

In `vite.auth.config.ts`, change the import:
```ts
import { getFederatedAuthRuntime } from "./src/shared/config/auth";
```
to:
```ts
import { DEVELOPMENT_BRIDGE_URL, getFederatedAuthRuntime } from "./src/shared/config/auth";
```

Change:
```ts
        server: {
            host: "127.0.0.1",
            port: 5174,
            strictPort: true,
        },
```
to:
```ts
        server: {
            host: "127.0.0.1",
            port: Number(new URL(DEVELOPMENT_BRIDGE_URL).port),
            strictPort: true,
        },
```

- [ ] **Step 2: Single-source the domain match pattern in manifest.config.ts**

Change:
```ts
export default defineManifest(({ mode }) => {
    const env = loadEnv(mode, '.', 'VITE_');
    const oauthClientId = env.VITE_GOOGLE_OAUTH_CLIENT_ID?.trim();
    const federatedAuth = getFederatedAuthRuntime(mode);
```
to:
```ts
const DOMAIN_MATCH_PATTERNS = ['*://domain.com.au/*', '*://www.domain.com.au/*'];

export default defineManifest(({ mode }) => {
    const env = loadEnv(mode, '.', 'VITE_');
    const oauthClientId = env.VITE_GOOGLE_OAUTH_CLIENT_ID?.trim();
    const federatedAuth = getFederatedAuthRuntime(mode);
```

Replace each of the 3 occurrences of `['*://domain.com.au/*', '*://www.domain.com.au/*']` (in `host_permissions`, `web_accessible_resources.matches`, and `content_scripts.matches`) with `DOMAIN_MATCH_PATTERNS`.

- [ ] **Step 3: Interpolate the support email in site legal copy**

In `src/apps/site/content.ts`, replace each literal occurrence of `niclas.rogulski@gmail.com` in the legal body text (6 occurrences, in the privacy/terms/data-deletion section bodies) with `${SUPPORT_EMAIL}` — since these are string array literals (not already template literals), each surrounding string needs converting from `"..."` to `` `...` `` where the email appears. For example, change:
```ts
"Extra Domain Filters is operated by Niclas Rogulski (we, us and our). You can contact us about privacy at niclas.rogulski@gmail.com.",
```
to:
```ts
`Extra Domain Filters is operated by Niclas Rogulski (we, us and our). You can contact us about privacy at ${SUPPORT_EMAIL}.`,
```
Apply the same backtick-and-interpolate change to the other 5 occurrences (in the "how-we-use-information"/"your-choices"/"contact" sections of the privacy policy, the terms "contact" section, and the data-deletion "make-a-request"/"contact" sections).

- [ ] **Step 4: Name the offscreen-auth timeout**

In `src/apps/extension/offscreen/offscreen.ts`, change:
```ts
    timeout = window.setTimeout(() => respond({
        message: "Login timed out. Please try again.",
        ok: false,
        requestId: message.requestId,
    }), 90_000);
```
to (adding the constant near the top of the file, after the imports):
```ts
const LOGIN_TIMEOUT_MS = 90_000;
```
```ts
    timeout = window.setTimeout(() => respond({
        message: "Login timed out. Please try again.",
        ok: false,
        requestId: message.requestId,
    }), LOGIN_TIMEOUT_MS);
```

- [ ] **Step 5: Name the Firestore batch size with a comment on the real limit**

In `src/apps/extension/background/telemetry.ts`, change:
```ts
const MAX_QUEUED_EVENTS = 250;
const RETENTION_MS = 30 * 24 * 60 * 60 * 1000;
```
to:
```ts
const MAX_QUEUED_EVENTS = 250;
const RETENTION_MS = 30 * DAY_MS;
// Firestore's writeBatch limit is 500 operations; 400 leaves headroom for the batch's own overhead.
const FIRESTORE_BATCH_SIZE = 400;
```
(This also fixes the "reinvents DAY_MS by hand" finding from the same file — requires importing `DAY_MS`. Add to the imports:)
```ts
import { DAY_MS } from "../utils/time";
```
Change:
```ts
    for (let offset = 0; offset < allowed.length; offset += 400) {
        const batch = writeBatch(services.firestore);
        for (const event of allowed.slice(offset, offset + 400)) {
```
to:
```ts
    for (let offset = 0; offset < allowed.length; offset += FIRESTORE_BATCH_SIZE) {
        const batch = writeBatch(services.firestore);
        for (const event of allowed.slice(offset, offset + FIRESTORE_BATCH_SIZE)) {
```

- [ ] **Step 6: Add a shared "let Domain's DOM settle" debounce constant**

In `src/apps/extension/dom/bodyMutations.ts`, add near the top (after the `BodyMutationListener` type):
```ts
export type BodyMutationListener = (mutations: readonly MutationRecord[]) => void;

/** How long to wait after Domain's own DOM stops mutating before re-checking it. */
export const DOMAIN_SETTLE_DELAY_MS = 120;
```

In `src/apps/extension/pages/shortlist.ts`, add the import:
```ts
import { DOMAIN_SETTLE_DELAY_MS } from "../dom/bodyMutations";
```
Change (2 occurrences):
```ts
        save.addEventListener("click", () => {
            window.setTimeout(reconcileCards, 120);
        });
```
to:
```ts
        save.addEventListener("click", () => {
            window.setTimeout(reconcileCards, DOMAIN_SETTLE_DELAY_MS);
        });
```
and:
```ts
        const schedule = (): void => {
            if (reconcileTimer !== undefined) window.clearTimeout(reconcileTimer);
            reconcileTimer = window.setTimeout(reconcileCards, 120);
        };
```
to:
```ts
        const schedule = (): void => {
            if (reconcileTimer !== undefined) window.clearTimeout(reconcileTimer);
            reconcileTimer = window.setTimeout(reconcileCards, DOMAIN_SETTLE_DELAY_MS);
        };
```

In `src/apps/extension/features/listing-cards/index.ts`, add the import (it already imports from `../../dom/bodyMutations`, so add to that existing import line):
```ts
import { DOMAIN_SETTLE_DELAY_MS, onBodyMutations } from "../../dom/bodyMutations";
```
Change:
```ts
    const scheduleAfterDomainSettles = (): void => {
        if (quietTimer !== undefined) window.clearTimeout(quietTimer);
        quietTimer = window.setTimeout(() => {
            quietTimer = undefined;
            reconciler.schedule();
        }, 120);
    };
```
to:
```ts
    const scheduleAfterDomainSettles = (): void => {
        if (quietTimer !== undefined) window.clearTimeout(quietTimer);
        quietTimer = window.setTimeout(() => {
            quietTimer = undefined;
            reconciler.schedule();
        }, DOMAIN_SETTLE_DELAY_MS);
    };
```

In `src/apps/extension/features/map/pins.ts`, add the import:
```ts
import { DOMAIN_SETTLE_DELAY_MS } from "../../dom/bodyMutations";
```
Change:
```ts
            timer = window.setTimeout(() => {
                timer = undefined;
                void refresh().catch(error => context.logger.warn("Failed to refresh map pins", error));
            }, 120);
```
to:
```ts
            timer = window.setTimeout(() => {
                timer = undefined;
                void refresh().catch(error => context.logger.warn("Failed to refresh map pins", error));
            }, DOMAIN_SETTLE_DELAY_MS);
```

- [ ] **Step 7: Name the map-calibration thresholds**

In `src/apps/extension/features/map/calibration.ts`, add near the top (after the interface declarations, before `fitLinear`):
```ts
/** How many marker/listing pairs to sample for the linear fit (more is diminishing returns). */
const CALIBRATION_SAMPLE_COUNT = 20;
/** Below this many samples, a linear fit isn't reliable enough to trust. */
const MINIMUM_CALIBRATION_SAMPLES = 4;
/** Reject a calibration whose fit error exceeds 15% of the pixel range — too inaccurate to use. */
const MAX_RESIDUAL_RATIO = 0.15;
/** Degrees of lat/lng within which a computed point is considered "at" a candidate listing. */
const NEAREST_POINT_MATCH_DEGREES = 0.01;
```

Change:
```ts
    const sampleCount = Math.min(20, markerPixels.length, listingCoordinates.length);
    if (sampleCount < 4) return undefined;
```
to:
```ts
    const sampleCount = Math.min(CALIBRATION_SAMPLE_COUNT, markerPixels.length, listingCoordinates.length);
    if (sampleCount < MINIMUM_CALIBRATION_SAMPLES) return undefined;
```

Change:
```ts
    if (residualRatio > 0.15) return undefined;
```
to:
```ts
    if (residualRatio > MAX_RESIDUAL_RATIO) return undefined;
```

Change:
```ts
    return distance <= 0.01 ? nearest : undefined;
```
to:
```ts
    return distance <= NEAREST_POINT_MATCH_DEGREES ? nearest : undefined;
```

- [ ] **Step 8: Name the domain-page retry constants**

In `src/apps/extension/platform/domainPageClient.ts`, read the current retry loop (`attempt < 24` and `delay(500)`) and add named constants near the top of the file:
```ts
/** ~12s total budget (24 attempts × 500ms) for a background Domain tab to become ready. */
const MAX_TAB_READY_ATTEMPTS = 24;
const TAB_READY_POLL_INTERVAL_MS = 500;
```
Replace the bare `24` in the retry loop condition with `MAX_TAB_READY_ATTEMPTS`, and the bare `500` in the `delay(500)` call with `TAB_READY_POLL_INTERVAL_MS`.

- [ ] **Step 9: Verify**

```bash
npx tsc --noEmit
npm run eslint
```

Expected: clean.

- [ ] **Step 10: Commit**

```bash
git add -A
git commit -m "refactor: name and single-source duplicated magic numbers"
```

---

## Task 7: Remove dead code

**Files:**
- Modify: `src/apps/extension/state/property.ts` (remove unused one-way bind machinery)
- Modify: `src/shared/authMessages.ts` (remove redundant type-guard recheck)

- [ ] **Step 1: Remove the unused one-way bind/unbind/Unbind machinery from property.ts**

Replace the full content of `src/apps/extension/state/property.ts` with:

```ts
import type { MaybePromise } from "../utils/types";

export type Disposer = () => void;

const noop: Disposer = () => {};

function once(dispose: Disposer): Disposer {
    let active = true;

    return () => {
        if (!active) return;

        active = false;
        dispose();
    };
}

export interface PropertyValues {
    boolean: boolean;
    number: number;
    string: string;
    range: { min: number; max: number };
}

export type PropertyKind = keyof PropertyValues;
export type PropertyValue<K extends PropertyKind> = PropertyValues[K];

export interface PropertyChange<K extends PropertyKind> {
    readonly source: Property<K>;
    readonly oldValue: PropertyValue<K>;
    readonly newValue: PropertyValue<K>;
}

export type PropertyObserver<K extends PropertyKind> = (
    change: PropertyChange<K>,
) => MaybePromise<void>;

export interface PropertyAdapter<T> {
    get(): MaybePromise<T>;
    set(value: T): MaybePromise<void>;
    observe?(observer: (value: T) => MaybePromise<void>): Disposer;
    dispose?(): void;
}

type PropertyLink = {
    readonly source: object;
    readonly target: object;
    readonly unbind: Disposer;
};

export class Property<K extends PropertyKind> {
    private readonly observers = new Set<PropertyObserver<K>>();
    private readonly links = new Set<PropertyLink>();

    private current: Promise<PropertyValue<K>>;
    private readonly stopAdapter: Disposer;
    private disposed = false;

    private constructor(
        readonly kind: K,
        initialValue: MaybePromise<PropertyValue<K>>,
        private readonly adapter?: PropertyAdapter<PropertyValue<K>>,
    ) {
        this.current = Promise.resolve(initialValue);
        this.stopAdapter = adapter?.observe?.(value => this.receive(value)) ?? noop;
    }

    static value<K extends PropertyKind>(
        kind: K,
        initialValue: PropertyValue<K>,
    ): Property<K> {
        return new Property(kind, initialValue);
    }

    static from<K extends PropertyKind>(
        kind: K,
        adapter: PropertyAdapter<PropertyValue<K>>,
    ): Property<K> {
        return new Property(kind, adapter.get(), adapter);
    }

    async get(): Promise<PropertyValue<K>> {
        this.assertActive();

        if (!this.adapter) return await this.current;

        const value = await this.adapter.get();
        this.current = Promise.resolve(value);

        return value;
    }

    async set(value: PropertyValue<K>): Promise<void> {
        this.assertActive();
        const adapter = this.adapter;
        await this.update(value, adapter ? () => adapter.set(value) : undefined);
    }

    observe(observer: PropertyObserver<K>): Disposer {
        this.assertActive();
        this.observers.add(observer);

        return once(() => this.observers.delete(observer));
    }

    async bindTwoWay(other: Property<K>): Promise<Disposer> {
        this.assertActive();
        other.assertActive();

        if (other === this) return noop;

        this.unbindTwoWay(other);

        let syncing = false;

        const sync = async (
            target: Property<K>,
            value: PropertyValue<K>,
        ): Promise<void> => {
            if (syncing) return;

            syncing = true;

            try {
                await target.set(value);
            } finally {
                syncing = false;
            }
        };

        await sync(other, await this.get());

        const stopForward = this.observe(({ newValue }) => sync(other, newValue));
        const stopBackward = other.observe(({ newValue }) => sync(this, newValue));

        return this.link(other, stopForward, stopBackward);
    }

    unbindTwoWay(other: Property<K>): void {
        for (const link of [...this.links]) {
            if (
                (link.source === this && link.target === other) ||
                (link.source === other && link.target === this)
            ) {
                link.unbind();
            }
        }
    }

    dispose(): void {
        if (this.disposed) return;

        this.disposed = true;
        this.stopAdapter();

        for (const link of [...this.links]) link.unbind();

        this.links.clear();
        this.observers.clear();
        this.adapter?.dispose?.();
    }

    private async receive(value: PropertyValue<K>): Promise<void> {
        if (this.disposed) return;
        await this.update(value);
    }

    private async update(
        newValue: PropertyValue<K>,
        write?: () => MaybePromise<void>,
    ): Promise<void> {
        const oldValue = await this.current;

        if (Object.is(oldValue, newValue)) return;

        this.current = Promise.resolve(newValue);

        try {
            await write?.();
        } catch (error) {
            this.current = Promise.resolve(oldValue);
            throw error;
        }

        const change: PropertyChange<K> = {
            source: this,
            oldValue,
            newValue,
        };

        for (const observer of [...this.observers]) {
            await observer(change);
        }
    }

    private link(
        target: Property<K>,
        ...subscriptions: Disposer[]
    ): Disposer {
        const link: PropertyLink = {
            source: this,
            target,
            unbind: once(() => {
                for (const unsubscribe of subscriptions) {
                    unsubscribe();
                }

                this.links.delete(link);
                target.links.delete(link);
            }),
        };

        this.links.add(link);
        target.links.add(link);

        return link.unbind;
    }

    private assertActive(): void {
        if (this.disposed) {
            throw new Error(`The ${this.kind} property has been disposed.`);
        }
    }
}
```

(Removed: `bind()`, the one-way-mode-clearing `unbind()` method, the `Unbind` type alias, and the `LinkMode`/`mode` field on `PropertyLink` — confirmed via grep that nothing outside this file references `Property.bind`, `.unbind(`, `Unbind`, `LinkMode`, or `PropertyLink`. `bindTwoWay`/`unbindTwoWay`/`dispose`/`link` are kept — `bindTwoWay` is the only binding method actually called, from `features/filters/controls.ts` and `features/filters/bindings/draft.ts`.)

- [ ] **Step 2: Remove the redundant isPlainObject recheck in authMessages.ts**

In `src/shared/authMessages.ts`, change:
```ts
export function isOffscreenAuthRequest(value: unknown): value is OffscreenAuthRequest {
    return isRequest(value) && isPlainObject(value) && value.target === "offscreen-auth";
}
```
to:
```ts
export function isOffscreenAuthRequest(value: unknown): value is OffscreenAuthRequest {
    return isRequest(value) && value.target === "offscreen-auth";
}
```

(`isRequest(value)` already starts with `isPlainObject(value)`, so by the time it returns `true`, `isPlainObject(value)` is provably already `true` — the second check was dead.)

- [ ] **Step 3: Verify**

```bash
npx tsc --noEmit
npm run eslint
```

Expected: clean.

- [ ] **Step 4: Commit**

```bash
git add -A
git commit -m "refactor: remove unused one-way Property binding and a redundant type-guard check"
```

---

## Task 8: Finish the Federated → Bridge naming cleanup

**Files:**
- Modify: `src/shared/authMessages.ts`
- Modify: `src/apps/auth/main.ts`
- Modify: `src/apps/extension/background/authBridge.ts`
- Modify: `src/apps/extension/background/authProviders.ts`
- Modify: `src/apps/extension/offscreen/offscreen.ts`

**Interfaces:**
- Produces: `shared/authMessages.ts` exports `AuthPageRequest`, `AuthResponse`, `isAuthPageRequest`, `isAuthResponse` (renamed from the `Federated`-prefixed versions). `FederatedAuthProvider` and `isFederatedAuthProvider` are unchanged — kept because they disambiguate from Google/email at call sites outside this file.
- Produces: `background/authBridge.ts` exports `AuthBridgeError` (renamed from `FederatedAuthError`) and `getAuthBridgeCredential` (renamed from `getFederatedCredential`).

- [ ] **Step 1: Rename in shared/authMessages.ts**

Change:
```ts
export interface OffscreenAuthRequest {
    provider: FederatedAuthProvider;
    requestId: string;
    target: "offscreen-auth";
    type: "federated-auth:start";
}

export interface FederatedAuthPageRequest {
    provider: FederatedAuthProvider;
    requestId: string;
    type: "federated-auth:start";
}

export type FederatedAuthResponse =
    | { credential: Record<string, unknown>; ok: true; requestId: string }
    | { code?: string; message: string; ok: false; requestId: string };

export function isFederatedAuthProvider(value: unknown): value is FederatedAuthProvider {
    return value === "apple" || value === "facebook";
}

function isRequest(value: unknown): value is FederatedAuthPageRequest {
    return isPlainObject(value)
        && value.type === "federated-auth:start"
        && typeof value.requestId === "string"
        && value.requestId.length > 0
        && isFederatedAuthProvider(value.provider);
}

export function isOffscreenAuthRequest(value: unknown): value is OffscreenAuthRequest {
    return isRequest(value) && value.target === "offscreen-auth";
}

export function isFederatedAuthPageRequest(value: unknown): value is FederatedAuthPageRequest {
    return isRequest(value) && !("target" in value);
}

export function isFederatedAuthResponse(value: unknown): value is FederatedAuthResponse {
    if (!isPlainObject(value)
        || typeof value.ok !== "boolean"
        || typeof value.requestId !== "string"
        || value.requestId.length === 0) return false;
    return value.ok
        ? isPlainObject(value.credential)
        : typeof value.message === "string" && (value.code === undefined || typeof value.code === "string");
}
```
to:
```ts
export interface OffscreenAuthRequest {
    provider: FederatedAuthProvider;
    requestId: string;
    target: "offscreen-auth";
    type: "federated-auth:start";
}

export interface AuthPageRequest {
    provider: FederatedAuthProvider;
    requestId: string;
    type: "federated-auth:start";
}

export type AuthResponse =
    | { credential: Record<string, unknown>; ok: true; requestId: string }
    | { code?: string; message: string; ok: false; requestId: string };

export function isFederatedAuthProvider(value: unknown): value is FederatedAuthProvider {
    return value === "apple" || value === "facebook";
}

function isRequest(value: unknown): value is AuthPageRequest {
    return isPlainObject(value)
        && value.type === "federated-auth:start"
        && typeof value.requestId === "string"
        && value.requestId.length > 0
        && isFederatedAuthProvider(value.provider);
}

export function isOffscreenAuthRequest(value: unknown): value is OffscreenAuthRequest {
    return isRequest(value) && value.target === "offscreen-auth";
}

export function isAuthPageRequest(value: unknown): value is AuthPageRequest {
    return isRequest(value) && !("target" in value);
}

export function isAuthResponse(value: unknown): value is AuthResponse {
    if (!isPlainObject(value)
        || typeof value.ok !== "boolean"
        || typeof value.requestId !== "string"
        || value.requestId.length === 0) return false;
    return value.ok
        ? isPlainObject(value.credential)
        : typeof value.message === "string" && (value.code === undefined || typeof value.code === "string");
}
```

- [ ] **Step 2: Update apps/auth/main.ts**

Change:
```ts
import {
    isFederatedAuthPageRequest,
    type FederatedAuthPageRequest,
    type FederatedAuthResponse,
} from "@shared/authMessages";
```
to:
```ts
import {
    isAuthPageRequest,
    type AuthPageRequest,
    type AuthResponse,
} from "@shared/authMessages";
```

Update the remaining references in the file: `FederatedAuthPageRequest` → `AuthPageRequest` (used as the `request` parameter type in `handleAuth`), `FederatedAuthResponse` → `AuthResponse` (used as the `send()` function's `response` parameter type), and `isFederatedAuthPageRequest` → `isAuthPageRequest` (used in the `window.addEventListener("message", ...)` guard).

- [ ] **Step 3: Update background/authBridge.ts**

Change:
```ts
import {
    isFederatedAuthResponse,
    type OffscreenAuthRequest,
} from "@shared/authMessages";
import { getBundledAuthRuntime, type FederatedAuthProvider } from "@shared/config/auth";
```
to:
```ts
import {
    isAuthResponse,
    type OffscreenAuthRequest,
} from "@shared/authMessages";
import { getBundledAuthRuntime, type FederatedAuthProvider } from "@shared/config/auth";
```

Change:
```ts
export class FederatedAuthError extends Error {
    constructor(message: string, readonly code?: string) {
        super(message);
        this.name = "FederatedAuthError";
    }
}
```
to:
```ts
export class AuthBridgeError extends Error {
    constructor(message: string, readonly code?: string) {
        super(message);
        this.name = "AuthBridgeError";
    }
}
```

Change:
```ts
        const response: unknown = await chrome.runtime.sendMessage(request);
        if (!isFederatedAuthResponse(response) || response.requestId !== request.requestId) {
            throw new Error("The hosted authentication page returned an invalid response.");
        }
        if (!response.ok) throw new FederatedAuthError(response.message, response.code);
```
to:
```ts
        const response: unknown = await chrome.runtime.sendMessage(request);
        if (!isAuthResponse(response) || response.requestId !== request.requestId) {
            throw new Error("The hosted authentication page returned an invalid response.");
        }
        if (!response.ok) throw new AuthBridgeError(response.message, response.code);
```

Change:
```ts
export function getFederatedCredential(provider: FederatedAuthProvider): Promise<Record<string, unknown>> {
```
to:
```ts
export function getAuthBridgeCredential(provider: FederatedAuthProvider): Promise<Record<string, unknown>> {
```

- [ ] **Step 4: Update background/authProviders.ts**

Change:
```ts
import { getFederatedCredential } from "./authBridge";
```
to:
```ts
import { getAuthBridgeCredential } from "./authBridge";
```

Change:
```ts
async function getBridgeCredential(provider: "apple" | "facebook"): Promise<AuthCredential> {
    const credential = OAuthCredential.fromJSON(await getFederatedCredential(provider));
```
to:
```ts
async function getBridgeCredential(provider: "apple" | "facebook"): Promise<AuthCredential> {
    const credential = OAuthCredential.fromJSON(await getAuthBridgeCredential(provider));
```

Also check `background/account.ts`, which imports `FederatedAuthError` from `./authBridge` (used in an `instanceof` check) — change:
```ts
import { FederatedAuthError } from "./authBridge";
```
to:
```ts
import { AuthBridgeError } from "./authBridge";
```
and update its 2 usages (`error instanceof FederatedAuthError` in two places) to `error instanceof AuthBridgeError`.

- [ ] **Step 5: Update offscreen/offscreen.ts**

Change:
```ts
import {
    isFederatedAuthResponse,
    isOffscreenAuthRequest,
    type FederatedAuthPageRequest,
    type FederatedAuthResponse,
} from "@shared/authMessages";
```
to:
```ts
import {
    isAuthResponse,
    isOffscreenAuthRequest,
    type AuthPageRequest,
    type AuthResponse,
} from "@shared/authMessages";
```

Update the remaining references in the file: `FederatedAuthResponse` → `AuthResponse` (the `respond` function's parameter type), `isFederatedAuthResponse` → `isAuthResponse` (in the `onMessage` guard), `FederatedAuthPageRequest` → `AuthPageRequest` (the type annotation on the `request` object built before `postMessage`).

- [ ] **Step 6: Verify**

```bash
npx tsc --noEmit
npm run eslint
```

Expected: clean.

- [ ] **Step 7: Commit**

```bash
git add -A
git commit -m "refactor: finish Federated-to-Bridge naming cleanup in auth messaging"
```

---

## Task 9: Standardize the "is this element ours" check in shortlist.ts

**Files:**
- Modify: `src/apps/extension/pages/shortlist.ts`

**Note:** This task assumes Task 5 has already landed (shortlist.ts's `installSortControl` is already the shared import by this point — this task only touches the separate `MutationObserver` block near the end of `mountShortlistPage`).

- [ ] **Step 1: Import isOwnedNode and replace the substring check**

Add to the imports:
```ts
import { isOwnedNode } from "../dom/ownership";
```

Change:
```ts
        const observer = new MutationObserver(mutations => {
            const hasDomainAddition = mutations.some(mutation =>
                [...mutation.addedNodes].some(node =>
                    node instanceof Element && !node.closest('[class*="edf-"]'),
                ),
            );
            if (hasDomainAddition) scheduleControls();
        });
```
to:
```ts
        const observer = new MutationObserver(mutations => {
            const hasDomainAddition = mutations.some(mutation =>
                [...mutation.addedNodes].some(node =>
                    node instanceof Element && !isOwnedNode(node),
                ),
            );
            if (hasDomainAddition) scheduleControls();
        });
```

- [ ] **Step 2: Verify**

```bash
npx tsc --noEmit
npm run eslint
```

Expected: clean.

- [ ] **Step 3: Commit**

```bash
git add -A
git commit -m "refactor: standardize shortlist.ts on isOwnedNode instead of a substring check"
```

---

## Task 10: Log the silent failures, document the brittle Domain-coupling sites

**Files:**
- Modify: `src/apps/auth/main.ts` (log sign-out cleanup failure)
- Modify: `src/apps/extension/features/filters/shareLink.ts` (log the Firebase fallback)
- Modify: `src/apps/extension/features/map/pins.ts` (comment on the hardcoded RGB check)
- Modify: `src/apps/extension/features/filters/bindings/draft.ts` (comment on the CSS-module substring selector)
- Modify: `src/apps/extension/features/listing-cards/cards/carousel.ts` (comment on the third-party carousel coupling)

- [ ] **Step 1: Log the auth sign-out cleanup failure**

In `src/apps/auth/main.ts`, this file has no logger today (it's a minimal hosted bridge page, not part of the extension's `createLogger` setup). Change:
```ts
    } finally {
        await signOut(auth).catch(() => undefined);
    }
```
to:
```ts
    } finally {
        await signOut(auth).catch(error => console.warn("Auth bridge sign-out cleanup failed", error));
    }
```
(A plain `console.warn` here, not `createLogger` — this file runs as a standalone hosted page outside the extension's logging setup, and adding the full logger module for one call site isn't warranted.)

- [ ] **Step 2: Log the share-link Firebase fallback**

In `src/apps/extension/features/filters/shareLink.ts`, add the import:
```ts
import { createLogger } from "../../platform/logging";
```
Add a module-level logger near the top:
```ts
const logger = createLogger("Share Link");
```
Change:
```ts
    try {
        const hosted = await createSharedSearch(filterParams.toString());
        const hostedUrl = new URL(selfContained);
        removeSharedFilterParams(hostedUrl.searchParams);
        hostedUrl.searchParams.set(HOSTED_SHARE_PARAM, hosted.id);
        return hostedUrl.href;
    } catch {
        return selfContained.href;
    }
```
to:
```ts
    try {
        const hosted = await createSharedSearch(filterParams.toString());
        const hostedUrl = new URL(selfContained);
        removeSharedFilterParams(hostedUrl.searchParams);
        hostedUrl.searchParams.set(HOSTED_SHARE_PARAM, hosted.id);
        return hostedUrl.href;
    } catch (error) {
        logger.warn("Could not create a hosted share link, falling back to a self-contained URL", error);
        return selfContained.href;
    }
```

- [ ] **Step 3: Document the hardcoded RGB pin-color check**

In `src/apps/extension/features/map/pins.ts`, change:
```ts
    for (const rect of pin.element.querySelectorAll<SVGRectElement>("rect")) {
        if (getComputedStyle(rect).fill === "rgb(124, 124, 123)") continue;
```
to:
```ts
    for (const rect of pin.element.querySelectorAll<SVGRectElement>("rect")) {
        // rgb(124, 124, 123) is Domain's current default marker grey — this only skips
        // recoloring pins that are still that exact color. If Domain changes their marker
        // theme, this stops matching and every pin gets recolored (harmless, just loses
        // the "already colored" skip-optimization).
        if (getComputedStyle(rect).fill === "rgb(124, 124, 123)") continue;
```

- [ ] **Step 4: Document the CSS-module substring selector**

In `src/apps/extension/features/filters/bindings/draft.ts`, change:
```ts
const clearSelector = [
    'button[aria-label="Clear all filter selections"]',
    'button[class*="pill-clear-button"]',
].join(', ');
```
to:
```ts
// The `pill-clear-button` substring matches Domain's generated CSS-module class name
// (e.g. "PillClearButton-abc123") — brittle if Domain's build tooling changes its class
// naming scheme, but there's no stable data-testid/aria-label alternative for this button today.
const clearSelector = [
    'button[aria-label="Clear all filter selections"]',
    'button[class*="pill-clear-button"]',
].join(', ');
```

- [ ] **Step 5: Document the third-party carousel coupling**

In `src/apps/extension/features/listing-cards/cards/carousel.ts`, add a comment near the top of the file (after the imports, before the first selector constant) explaining the coupling:
```ts
// This targets the Slick carousel library's own DOM structure (.slick-track, .slick-slide,
// .slick-current) and English-language aria-label text ("Previous"/"Next" property), since
// Domain doesn't expose a stable data-testid for carousel navigation. If Domain swaps carousel
// libraries, changes button copy, or serves a non-English locale, this feature silently stops
// working rather than erroring — there's no reliable way to detect that from here.
```
(Place this comment at the top of the file, before the first `const`/selector declaration — read the file first to confirm the exact insertion point next to the existing selector constants.)

- [ ] **Step 6: Verify**

```bash
npx tsc --noEmit
npm run eslint
```

Expected: clean.

- [ ] **Step 7: Commit**

```bash
git add -A
git commit -m "refactor: log previously-silent failures, document brittle Domain-markup coupling"
```

---

## Task 11: Full verification

**Files:** none — this task only runs checks.

- [ ] **Step 1: Full static checks**

```bash
npm run check:all
```

Expected: typecheck, eslint, stylelint all clean.

- [ ] **Step 2: All three builds**

```bash
npm run build
npm run build:auth
npm run build:site
```

Expected: all succeed.

- [ ] **Step 3: Dev servers boot**

```bash
npm run dev
```

Expected: extension, auth, and site dev servers all start, then stop the command.

- [ ] **Step 4: Manual UI spot-check**

Load the built `dist/` as an unpacked extension in Chrome, open a domain.com.au search results page with saved searches, and confirm:
- Saved-search summary labels (property type, suburb names with hyphens like "Inner West") render identically to before the `toTitleCase`/`slugToTitleCase` split.
- Shortlist and blacklist pages' sort controls still work (Task 5's consolidation).
- No console errors referencing missing modules or broken imports.

- [ ] **Step 5: Final commit (if the spot-check required fixes)**

```bash
git add -A
git commit -m "fix: address issues found in code quality cleanup verification"
```

(Skip this step if Step 4 found nothing to fix.)
