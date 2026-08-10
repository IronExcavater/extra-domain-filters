# Extension UI platform refresh design

Status: approved by user on 2026-08-10; ready for implementation planning.

## Problem

Extra Domain Filters has accumulated several extension features by cloning or patching
Domain DOM. That made early integration quick, but it now couples behavior and appearance
to CSS-hashed classes, duplicated render loops, inferred click state, and native forms whose
meaning changes between Domain releases.

The visible failures are symptoms of that architecture:

- Choosing Never in Domain's alert editor can be confused with Domain's `DELETE` sentinel.
- Saved-search creation and editing use different full-page modal and compact-popover paths.
- Saved-search cards on Domain and in the popup share data but have awkward layout and
  duplicated collection orchestration.
- The My Searches and Blacklist popup toolbars visually move during route transitions even
  though the controls occupy the same shell position.
- The listing-detail blacklist action inherits Domain implementation classes.
- Domain navbar chevrons maintain speculative click state instead of reflecting the menu's
  actual state.
- Tooltips and action controls are individually styled rather than consistently derived
  from an extension design system.
- Account authentication is Google-only and the current sign-in view is not a complete
  login or registration experience.

The user also requested a broader audit for direct patching, duplication, and unnecessary
code. The desired direction is replacement-first: every surface created by the extension
owns its markup, style, behavior, and lifecycle. Domain-specific interaction remains only
inside narrow adapters where it is unavoidable.

## Goals

- Establish a compact set of extension-owned UI, mounting, collection, and Domain-adapter
  primitives.
- Replace extension-created cloned controls with stable extension markup and CSS.
- Use the same saved-search card, alert popover, and collection behavior on Domain pages and
  in the popup.
- Preserve real Domain Daily/Weekly email alerts while presenting a fully extension-owned
  alert interface.
- Make Never mean "retain the search with email notifications disabled" and make deletion
  a separate destructive action.
- Add email/password login, email/password registration, password recovery, Apple OAuth,
  and Facebook OAuth while retaining the working Google flow.
- Rebuild navigation chevron behavior from actual menu state.
- Bring the approved listing-exclusion design back into compliance where the current code
  has drifted.
- Remove obsolete modals, CSS-hash coupling, duplicated controllers, cloning helpers, and
  dead legacy code made unnecessary by the replacements.
- Keep the implementation readable and materially reduce one-off feature code.

## Constraints and non-goals

- Do not add automated test specifications, test files, or a test framework. Verification
  uses the existing typecheck, ESLint, Stylelint, production build, and manual browser
  flows.
- Do not replace unrelated Domain product functionality. Replacement applies to surfaces
  that Extra Domain Filters creates or deliberately takes over.
- Daily and Weekly must continue to create real Domain email alerts. The extension will not
  add its own email-delivery backend.
- Google sign-in already works and must remain working.
- Apple and Facebook require external provider configuration. Secrets stay in the
  Apple, Meta, and Firebase consoles; none are committed or bundled.
- The user's untracked `.vscode` files are unrelated and must remain untouched.
- Existing local and Firestore synchronization behavior must be preserved while its schema
  mismatch is corrected.

## Audit findings

### Existing formal specification

The only existing formal product design is
`docs/superpowers/specs/2026-07-12-listing-exclusion-ui-design.md`. Its core model and much
of its row/bundle work exist, but the following approved behavior is missing or divergent:

- Filtered carousel children are skipped by the current update path.
- Carousel cards are explicitly forced visible instead of hiding when every child is
  excluded.
- A grouped listing's chevron restores it immediately instead of opening the specified
  second disclosure level containing the action.
- Mixed blacklisted/filtered groups use "blacklisted listings" accessibility labels.
- Reveal suppression occurs downstream from matching rather than at the exclusion-decision
  boundary described by the design.
- Top-level layout uses a broad FLIP animation that moves cards instead of the scoped
  collapse/expand behavior specified for exclusion rows.

These gaps are in scope for this refresh and will use the new shared primitives.

### Direct patching and duplication

- Alert handling is split across a 405-line native-form patcher and a separate 263-line
  modal implementation with 455 lines of modal CSS.
- The blacklist and saved-search collections each duplicate page and popup filtering,
  sorting, selection, rendering, and bulk-action logic.
- Listing blacklist controls copy Domain classes in a 299-line cloning module, including
  known CSS-hash fallbacks.
- Filters, account-menu entries, recent-search cards, preference tags, and profile entries
  clone native nodes or copy native classes for extension-created UI.
- Navigation, settings/profile, recent searches, alert handling, and listing details contain
  CSS-hashed selectors.
- Several route features independently hide, replace, observe, and restore Domain nodes.
- The root `domain.js` file is tracked legacy code but is not referenced by the current
  Vite/manifest entry points.
- There is no automated regression harness. Per the explicit constraint above, one will not
  be introduced in this work.
- Firestore saved-search rules omit optional `newListingCount`, although synchronized
  `SavedSearch` values can contain it.

## Architecture

### Owned UI primitives

`shared/ui` will expose a small, composable Domain-2026-inspired system:

- button variants: primary, secondary, quiet, danger, and icon;
- tooltip with accessible description, arrow, viewport collision handling, focus/hover
  support, and reduced-motion behavior;
- anchored popover with focus management, outside-click/Escape dismissal, viewport
  collision handling, and deterministic teardown;
- dropdown, tabs, card action rail, collection toolbar, inline field error, and busy state;
- design tokens for color, radius, spacing, typography, elevation, focus ring, and motion.

Every primitive owns all structural class names. It never receives or stores a Domain CSS
class as its skin. Density modifiers may adapt a shared component to popup and page widths
without changing its markup or behavior.

### Replacement-slot lifecycle

`shared/mounting` will provide one lifecycle for extension replacements:

1. Find a host through a Domain adapter.
2. Capture the native surface's original visibility/placement state.
3. Mount one owned root into a stable slot and optionally hide the native surface.
4. Reconcile only when the host or source data changes.
5. Dispose listeners and observers through an abort signal.
6. Remove the owned root and restore native state on route teardown.

This replaces feature-specific MutationObservers and manual hide/remove/restore sequences.
A single shared body observer may notify slots, but feature renderers will not observe the
entire document independently.

### Domain adapters

`shared/domain` will contain the unavoidable knowledge of Domain markup. Adapters expose
stable semantic capabilities rather than DOM details:

- alert trigger discovery, form discovery, frequency selection, submission, and confirmed
  result;
- navbar trigger/menu pairing and actual expanded state;
- listing/card snapshots and supported insertion slots;
- native saved-search import/removal;
- native filter host and profile/account insertion slots.

Adapters prefer `data-testid`, role, accessible name, form control name, and value. CSS-hash
selectors are removed from migrated features. A failure to find a supported semantic shape
returns a typed unavailable result rather than silently falling through to guessed classes.

### Collection system

`shared/collections` will own filter state, sort state, selection, select-all behavior,
bulk actions, retained/restored records, empty state, and card-region rendering. It accepts
feature-specific operations for:

- obtaining an item ID;
- filtering and sorting items;
- rendering one card;
- performing one-item and bulk mutations.

Saved Searches and Blacklist use this controller on Domain pages and in the popup. Surface
options control density, link target, and available actions. State is scoped to the mounted
collection instead of being split across independent module-level sets and maps.

### Feature renderers

Feature renderers consume models, shared primitives, and adapters. They do not clone native
nodes. This applies to saved searches, blacklist/listing actions, extension filters, share
actions, recent-search cards, account-menu entries, settings/profile entries, tooltips, and
navigation indicators.

Native Domain filters remain native. The extension's additional filters are rendered as an
owned block mounted beside the native filter host.

## Saved searches and alerts

### Card

One saved-search card is shared between Domain and popup surfaces.

- The whole non-control content region is the primary link to the search.
- There is no View Properties button.
- The content hierarchy is category, title/new count, essential bed/bath/parking summary,
  and important filter chips.
- Alert, Share, and Delete are equal-size icon buttons in one action rail.
- Share is icon-only and announces its action through the shared tooltip.
- Checkbox and action interactions stop card navigation.
- Page and popup density use modifiers on the same structure.

### Alert popover

One anchored popover handles creation and editing everywhere.

- It opens from a saved-search bell or the home/search property-alert trigger.
- It offers Daily, Weekly, and Never.
- Create and Edit use the same structure and differ only in title, initial value, and
  available destructive action.
- Cancel closes without mutation.
- Save/Update is the primary action.
- Delete is a separate danger action shown only when a persisted alert/search exists.
- The old full-screen modal, fake off-market radio group, compact/full modal branching, and
  modal stylesheet are deleted.

### Domain alert bridge

Daily and Weekly require Domain's authenticated email service. The extension popover calls
a narrow `DomainAlertBridge`:

1. Locate and activate the native alert trigger.
2. Make the resulting native alert surface hidden and inert before it becomes interactive
   to the user.
3. Discover controls by semantic role/name/value.
4. Select Daily or Weekly and submit the native form.
5. Observe the native trigger/form state and return only after success or a bounded timeout.
6. Restore or dispose the hidden native surface.

Never disables the native Domain email alert when one exists, then retains the extension
saved search with `notificationFrequency: "none"`. The native operation may remove Domain's
email-alert record, but it must not remove the extension saved-search record or card.

Delete removes the Domain saved search when it has a `domainId`, then removes the extension
record. For an extension-only search it removes the extension record only.

Local state updates only after required Domain work succeeds. If Domain has changed and the
bridge cannot confirm success, existing state stays intact and the popover shows a clear
compatibility error.

## Popup behavior and motion

The popup shell and primary navigation remain mounted while switching views. My Searches
and Blacklist render through the same collection frame, so the equivalent toolbar occupies
the same grid row and does not enter/leave with view animation.

Only the card region receives a short opacity transition. The existing vertical
translation is removed. Reduced-motion preference disables nonessential motion.

## Tooltips

All extension icon actions use one tooltip implementation:

- Domain-style dark neutral surface, white text, compact typography, small radius, subtle
  elevation, and directional arrow;
- collision-aware top/bottom placement and horizontal viewport clamping;
- hover and keyboard-focus activation;
- no tooltip while a control is pressed or disabled;
- current text updates in place without duplicate event listeners;
- deterministic teardown through the owning abort signal.

## Listing actions

A unified extension-owned blacklist action replaces native-class cloning for standard
cards, project cards, carousel controls, shortlist cards, and listing details. Context
options determine label, icon-only/text presentation, and placement, but active, hover,
focus, disabled, busy, and error behavior comes from one component.

The listing-detail action is a bordered icon control designed to sit with Domain CTAs while
remaining visually correct if every Domain class changes. It never copies the shortlist or
share button's class name.

## Navigation chevrons

Each Domain navbar trigger is paired with its actual menu. Open state is derived in priority
order from `aria-expanded`, a semantic native open state, or the paired menu's connected and
visible state. A targeted observer synchronizes changes made by pointer, keyboard, Domain
scripts, navigation, or outside dismissal.

Closed is the untransformed down chevron. Open rotates the same element 180 degrees around
its center. Initial binding synchronizes without animation; subsequent real state changes
animate once. Escape and outside-click behavior remains Domain-owned. Reduced-motion
preference removes the transition.

## Authentication

### Login view

The popup route and copy use `login` rather than `sign-in`.

- The default form is Log in with email and password.
- A clear switch opens Create account with email, password, and password confirmation.
- Password inputs provide show/hide controls.
- Forgot password sends Firebase's reset email and confirms the action without revealing
  whether an account exists.
- An "or continue with" divider separates provider buttons.
- Google, Apple, and Facebook buttons share sizing and hierarchy.
- Provider buttons appear only when their build/provider capability is configured.
- Validation and actionable Firebase failures appear inline. Success returns to the popup
  view from which login was opened.

### Account service

The account client/background contract becomes provider-neutral and includes:

- get state;
- log in with email/password;
- create account with email/password;
- send password reset;
- log in with Google, Apple, or Facebook;
- sign out.

Requests validate email/password/provider fields and never log credentials. Firebase error
mapping avoids email-enumeration leaks. Settings and navigation consume the same service and
session state.

### Apple and Facebook OAuth

Email/password methods run directly through `firebase/auth/web-extension`. Existing Google
OAuth remains on its working Chrome Identity flow.

Apple and Facebook use Firebase's Manifest V3 offscreen-document pattern:

1. The background creates one offscreen document for an interactive, user-initiated auth
   request.
2. The offscreen document embeds a Firebase-hosted helper page from one configured origin.
3. The helper runs standard Firebase `signInWithPopup` for the requested provider.
4. It serializes only the resulting provider credential and correlated request ID.
5. The offscreen proxy accepts messages only from the configured helper origin and matching
   request ID.
6. The background reconstructs the credential and calls `signInWithCredential` on the
   extension's persistent Firebase Auth instance.
7. The offscreen document closes on success, failure, cancellation, or timeout.

The extension adds the `offscreen` permission and only the Firebase/Google hosts required by
the selected architecture. The hosted helper contains public Firebase configuration only.
Apple private keys and Meta app secrets remain exclusively in their provider/Firebase
configuration.

### Provider configuration delivered with the implementation

The repository will include deployable Firebase Hosting helper assets, Firebase hosting
configuration, non-secret environment placeholders, and README steps for:

- enabling Email/Password in Firebase Authentication;
- adding the extension and helper domains to Firebase authorized domains;
- creating a Meta app, adding Facebook Login, entering the Firebase OAuth redirect URI,
  and enabling Facebook in Firebase with the app ID/secret;
- creating Apple's Services ID and Sign in with Apple private key, registering Firebase's
  return URL, configuring Apple's email relay as required, and enabling Apple in Firebase
  with the Services ID, Team ID, Key ID, and private key;
- deploying the helper and setting the extension's helper URL;
- performing a provider-by-provider manual smoke check.

## Error handling

- All async UI actions enter a busy state that prevents duplicate submission and always
  restore controls in `finally`.
- Domain-adapter failures are typed as unavailable, changed markup, rejected, cancelled, or
  timed out and receive surface-appropriate messages.
- Authentication cancellations are neutral; configuration failures explain the missing
  provider setup; credential/account conflicts provide a safe recovery direction.
- Clipboard, storage, Firebase, and Domain bridge errors remain local to the initiating
  surface and do not destroy current selection or form state.
- Owned roots and temporary native surfaces are removed on route abort or popup rerender.

## Data and synchronization

- `SavedSearch.notificationFrequency` remains `daily | weekly | none`.
- Never is never represented internally as `DELETE`.
- Domain IDs continue to identify imported Domain searches.
- Firestore saved-search validation accepts optional non-negative integer
  `newListingCount`, matching the local model, or the sync serializer deliberately strips
  the field. The implementation will choose the former so new-count data remains available
  across signed-in devices.
- Existing logical-clock merge and soft-delete behavior remain unchanged.

## Cleanup outcomes

After consumers migrate, remove:

- `features/saved-searches/card/modal.ts` and `modal.css`;
- full/compact modal flags and exports;
- native alert mutation/normalization code superseded by `DomainAlertBridge`;
- Domain-class blacklist skins and class-cloning helpers;
- duplicated popup/page collection render loops and module-level collection state;
- migrated feature clone helpers and CSS-hash fallbacks;
- obsolete manifest CSS entries;
- the unreferenced root `domain.js` legacy bundle.

Files are split by responsibility, but no abstraction is introduced without at least two
real consumers or a clear platform boundary. The objective is less code and fewer concepts,
not a generic framework.

## Delivery packages

The umbrella design is delivered through four ordered implementation packages so each
review boundary leaves working software:

1. **Owned UI foundation and high-churn controls:** design tokens, primitives, replacement
   slots, collection controller, stable popup shell/toolbar, shared tooltips, independent
   listing blacklist actions, and state-derived navbar chevrons.
2. **Saved searches and Domain alerts:** shared cards, page/popup collection migration,
   alert popover, Domain alert bridge, Never/Delete semantics, Firestore rule correction,
   and deletion of all full-page saved-search modal code.
3. **Account and provider configuration:** provider-neutral account contract, login/create
   account/password-reset UI, Apple/Facebook offscreen authentication, Firebase Hosting
   helper, non-secret environment keys, and complete configuration documentation.
4. **Specification closure and remaining clone cleanup:** listing-exclusion corrections,
   extension-filter/recent-search/profile replacement migration, removal of superseded
   cloning helpers and CSS-hash fallbacks, and removal of the legacy `domain.js` bundle.

Package 1 supplies the shared contracts used by the later packages. Packages 2 through 4
do not introduce alternate UI or mounting systems; they migrate their surfaces onto the
same foundation.

## Verification

No automated testing specifications or test framework will be added.

Fresh completion evidence must include:

- `npm run typecheck`;
- `npm run eslint`;
- `npm run stylelint`;
- `npm run build`;
- manual popup checks for stable My Searches/Blacklist toolbar position, saved-search card
  navigation/actions, popover create/edit/Never/Delete, tooltip behavior, login/register,
  password reset, and each configured OAuth provider;
- manual Domain checks for home/search alert creation and editing, saved-search route
  replacement, listing-detail blacklist independence, navbar pointer/keyboard/outside-close
  behavior, and the listing-exclusion cases from the approved specification;
- a final search confirming migrated features contain no obsolete modal references or
  Domain CSS-hash class dependencies.
