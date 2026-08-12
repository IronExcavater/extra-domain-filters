# Code Quality Cleanup Design

## Goal

Fix the concrete, evidence-backed maintainability problems found by a three-part codebase audit (business logic/sync, UI/interaction layer, infra/cross-cutting): duplicated logic that should be one shared implementation, global prototype monkey-patching, unnamed/duplicated magic numbers, dead code, and leftover naming inconsistency. This is a correctness/maintainability pass, not a feature change — behaviour stays the same except where a finding was an actual latent bug (the redundant/misleading `toTitleCase` naming collision, the `console.warn`-bypasses-log-level issue).

## Findings and Resolutions

### 1. Global monkey-patching → plain exported functions

`utils/math.extensions.ts` (`Math.clamp`, `Math.percent` via `Object.defineProperty` on the global `Math` object) and `utils/string.extensions.ts` (`String.prototype.toTitleCase`, `toSentenceCase`) patch built-in globals instead of exporting plain functions.

- `Math.clamp`/`Math.percent`: **delete outright** — grep confirms zero call sites anywhere in the codebase.
- `String.prototype.toTitleCase`/`toSentenceCase`: become plain exports `toTitleCase(value: string): string` and `toSentenceCase(value: string): string` from `utils/string.ts` (renamed from `string.extensions.ts` since it's no longer a global extension). Every `"...".toTitleCase()` / `"...".toSentenceCase()` call site becomes `toTitleCase("...")` / `toSentenceCase("...")`.
- `features/saved-searches/card/summary.ts`'s local `toTitleCase` is a **different operation** (converts `+`/`/`/`_`/`-` delimiters to spaces before title-casing — used to turn URL-param slugs like `"inner-west"` into `"Inner West"`), not a duplicate of the global one (which preserves delimiter characters). It gets renamed to `slugToTitleCase` to stop the misleading name collision, and stays local to that file (it's not needed elsewhere).

### 2. Sync-queue duplication → `p-queue` package

`background/blacklistSync.ts`, `savedSearchSync.ts`, `settingsSync.ts`, `telemetry.ts` each hand-roll an identical serialize-and-continue async queue (`queue = queue.then(fn).catch(() => undefined)`) plus an identical "ignore my own echo" fingerprint-comparison pattern for reacting to `chrome.storage.onChanged`.

- Add the `p-queue` dependency (small, zero heavy deps, actively maintained) and replace each file's hand-rolled queue with a `new PQueue({ concurrency: 1 })` instance, `.add(fn)` instead of the manual `.then()`/`.catch()` chain.
- The "ignore my own echo" fingerprint pattern is small enough (a few lines) to stay as its current per-file pattern — it's not pure duplication, each file's fingerprint shape differs slightly by data type — but each file's failure path switches from `console.warn(...)` to the existing `createLogger` utility (from `platform/logging.ts`), fixing the log-level bypass the audit found.

### 3. Consolidate the 4 `waitForElement` implementations

`dom/wait.ts`'s `waitForElement` (proper `AbortSignal` handling, no timeout) is the most correct of the four. Extend it with an optional `timeoutMs` parameter to cover the one caller that needs a give-up timeout (`site-dom/alerts.ts`). Migrate `content/main.ts`'s `waitForDomainElement`, `site-dom/alerts.ts`'s `waitFor`, and `dom/trigger.ts`'s embedded MutationObserver logic in `waitForTarget` to call the shared `waitForElement` instead of reimplementing it. Delete the three local reimplementations.

### 4. Fix the `normalizeUrl` naming collision

`domain/listings/url.ts`'s `normalizeListingUrl` (trailing-slash strip) becomes the one canonical implementation. `background/blacklistSync.ts` and `domain/matching/index.ts`'s identical local `normalizeUrl` functions are deleted; both import `normalizeListingUrl` instead. `domain/searches/recentSearches.ts`'s `normalizeUrl` — a genuinely different operation (query-param canonicalization, not trailing-slash stripping) — gets renamed to `normalizeSearchUrl` so the name no longer collides with an unrelated function.

### 5. Dedupe `installSortControl` and repeated DOM selector constants

`installSortControl` (currently copy-pasted between `pages/shortlist.ts` and `pages/blacklist.ts`) moves into `features/user-listings/page.ts`, which already owns the related `getPageActions`/`replaceUserListingTabs` helpers for these two pages, as the single implementation both pages call.

The independently-redefined selector constants collapse to one export each, referenced everywhere else instead of re-declared:
- `[data-testid="listing-card-container"]` — keep the existing export in `features/listing-cards/dom/card.ts`, remove the duplicate in `features/user-listings/page.ts` and the inline literal in `pages/blacklist.ts`.
- `[data-testid="listing-card-exclusion-row"]` — keep one export (in `features/listing-cards/exclusion/row.ts`, since `compact.ts` imports from it already for other things), remove the duplicate in `compact.ts`.
- `[data-testid="listing-tabs__filters-sort-by"]` — export `SORT_SELECTOR` from `features/user-listings/page.ts` (already defined there, just not exported) instead of re-typing the literal in `shortlist.ts`/`blacklist.ts`.

### 6. Name and single-source the magic numbers

- **Dev auth-bridge port**: `vite.auth.config.ts`'s `server.port: 5174` is replaced with `Number(new URL(DEVELOPMENT_BRIDGE_URL_EXPORT).port)` — this requires exporting the dev bridge URL (or just the port) from `shared/config/auth.ts` so both the runtime code and the Vite dev-server config read the same literal. (`DEVELOPMENT_BRIDGE_URL` is currently a private `const`; export it.)
- **`manifest.config.ts` domain match pattern**: repeated 3x (`host_permissions`, `web_accessible_resources.matches`, `content_scripts.matches`) — becomes one `const DOMAIN_MATCH_PATTERNS = ['*://domain.com.au/*', '*://www.domain.com.au/*']` referenced in all three places.
- **Site legal copy's hardcoded email**: `apps/site/content.ts`'s 6 literal `niclas.rogulski@gmail.com` occurrences in privacy/terms/data-deletion body text become `${SUPPORT_EMAIL}` template interpolations (the constant is already imported at the top of the file).
- **Named constants with a short comment** for: the offscreen-auth 90s timeout (`offscreen/offscreen.ts`), the Firestore telemetry batch size of 400 (`background/telemetry.ts` — comment notes the real Firestore batch limit is 500 and this is a safety margin), the 120ms "let Domain's DOM settle" debounce (currently duplicated as a bare literal in 3 files — becomes one exported constant, e.g. `DOMAIN_SETTLE_DELAY_MS` in `dom/`, imported by `pages/shortlist.ts`, `features/listing-cards/index.ts`, `features/map/pins.ts`), the map-calibration thresholds in `features/map/calibration.ts` (sample count cap, minimum-sample gate, residual-fit rejection threshold, match radius — each gets a name and a one-line comment on what it controls), and the `domainPageClient.ts` retry loop (24 attempts × 500ms — named constants, comment noting the ~12s total budget).
- The three coincidentally-identical `250` caps (blocklist capacity, cache entries, queued events) are already independently named — no change needed, they're not duplication, just a coincidence.

### 7. Remove dead code

- `state/property.ts`: delete the unused one-way `bind`, `unbind`, `unbindTwoWay`, and the `PropertyLink` bookkeeping that only exists to support them (~80 lines) — only `bindTwoWay` has any callers (3, all in `features/filters`). Keep `bindTwoWay` and whatever `dispose()` logic it actually needs.
- `authMessages.ts`: remove the redundant `isPlainObject(value)` recheck inside `isOffscreenAuthRequest` — `isRequest(value)` already guarantees it.

### 8. Finish the Federated → Bridge naming cleanup

Same rationale as the earlier `config/auth.ts` cleanup (already done): a symbol living entirely inside a file whose name already says "auth bridge" doesn't need to repeat "Federated" on every export.

- `shared/authMessages.ts`: `FederatedAuthPageRequest`→`AuthPageRequest`, `FederatedAuthResponse`→`AuthResponse`, `isFederatedAuthPageRequest`→`isAuthPageRequest`, `isFederatedAuthResponse`→`isAuthResponse`. `FederatedAuthProvider` **stays** — it's imported and used at call sites outside this file where it genuinely disambiguates from Google/email auth.
- `background/authBridge.ts`: `FederatedAuthError`→`AuthBridgeError`, `getFederatedCredential`→`getAuthBridgeCredential` (aligns with `authProviders.ts`'s own existing internal `getBridgeCredential` naming for the same concept — currently two different names for one thing, 20 lines apart).

### 9. Standardize the "is this element ours" check

`pages/shortlist.ts` uses a fragile substring class match (`node.closest('[class*="edf-"]')`) where every other file in the codebase uses the proper `isOwnedNode()` from `dom/ownership.ts`. Replace it.

### 10. Log the currently-silent failures

`apps/auth/main.ts`'s `signOut(auth).catch(() => undefined)` cleanup and `features/filters/shareLink.ts`'s Firebase-call fallback `catch { return selfContained.href; }` currently swallow errors with zero trace. Add a log call (via the appropriate logger for each context) so a systemic failure is visible instead of silently invisible.

## Explicitly not fixing

- **Brittle Domain.com.au markup coupling** (hardcoded RGB color match in `features/map/pins.ts`, CSS-module substring class match in `features/filters/bindings/draft.ts`, English-only `aria-label` text matching against the third-party Slick carousel in `features/listing-cards/cards/carousel.ts`) — inherent to a page-scraping extension reading a third party's arbitrary markup; there's no real structural fix, only documentation. Add a short comment at each site explaining the coupling and what breaks if Domain changes their markup.
- **`EFFECTIVE_DATE` hardcoded value** in site legal content — this is legal-copy content to bump whenever the policy text actually changes, not a code defect.
- **`isPlainObject`/`applyPatch`** — stay hand-rolled. Both are small, already correct for the data shapes actually used (no `Date`/`RegExp`/class-instance values ever reach them — Settings/sync data is JSON-safe by construction), and `applyPatch` in particular is exercised across sync-critical code where swapping to a reconfigured deep-merge package risks subtle behavior drift for no real gain.

## Verification

- `npm run check:all` clean after every task, same discipline as the src restructure.
- `npm run build` / `build:auth` / `build:site` all succeed.
- `npm run dev` boots all three dev servers.
- Manual spot-check: no visible UI text changes from the `toTitleCase`/`slugToTitleCase` split (property-type/suburb labels in saved-search summaries should render identically to before).
