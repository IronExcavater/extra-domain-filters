# Listing exclusion UI: unified blacklist + filter-override design

Status: approved by user (brainstorming session), ready for implementation planning.

## Problem

Blacklisted listings and filter-excluded listings are currently handled by separate,
inconsistent code paths:

- Blacklisted standard/carousel-child cards collapse into a summary bar
  (`edf-blacklist-summary`) with an "Unblacklist" button.
- Filter-excluded cards (keyword/strata/property-type exclusion) are hidden outright
  (`card.hidden = true`) with no way to see or restore them without changing filters.
- Project cards have their own bespoke inline button + aggregate-summary logic, built
  separately from the standard-card path.
- Featured/topspot carousel cards have no per-child or whole-card exclusion handling at all.

This spec unifies all of the above into one exclusion model and one shared collapsed-row
UI component, and defines specific (differing) behavior for the handful of card shapes that
need it: standard cards, cards inside a carousel (featured/topspot or project units), and
whole bundle cards (a project or a featured carousel, each containing multiple listings).

## Goals

- One consistent visual treatment for "this listing is hidden, here's why, here's how to
  undo it" — whether hidden by blacklist or by filters.
- Filter-excluded listings become individually recoverable (an "eye" toggle), without
  requiring the user to change their filter settings.
- Reduce duplicated logic between standard-card, project, and (new) carousel-card handling
  by extracting their shared "bundle of listings" concerns into one place.
- Smooth, animated collapse/expand instead of instant show/hide.

## Non-goals

- No *floating* hover-popup / preview-on-hover overlay. (Explored during brainstorming;
  rejected — a floating preview over the list was judged to add complexity without enough
  benefit, since the action button already reveals the real listing directly.) This is
  distinct from the in-place hover-to-expand grouping described below, which pushes the
  surrounding list content down rather than floating over it, and was added after the user
  reviewed the first draft of this spec.
- No whole-extension folder/complexity reorganization. This spec is scoped to
  `listing-cards/` and `matching/`. A broader reorg is a separate, later spec.
- No persistence for filter-reveal overrides. Revealing a filtered listing is a session-only
  choice (an in-memory set), not written to `chrome.storage`. Blacklist entries keep their
  existing persistent storage (including the existing soft-delete/`removedAt` behavior).
- Not attempting to control Domain's slick-carousel instance through its own JS API (we
  don't have a reference to it) — see "Known technical risk" below.

## Core data model

`matching/index.ts`'s `ListingMatch` changes from:

```ts
interface ListingMatch {
    excluded: boolean;
    blacklisted: boolean;
    matchedPreferences: PreferenceRule[];
}
```

to:

```ts
type ExclusionReason = "none" | "blacklisted" | "filtered";

interface ListingMatch {
    exclusionReason: ExclusionReason;
    matchedPreferences: PreferenceRule[];
}
```

`matchedPreferences` (inclusion reasons — which could-have rules matched) stays exactly as
it is today; it's an orthogonal, independent signal from exclusion and continues to drive
the existing yellow "matched preference" outline on cards that are shown normally.

`exclusionReason` priority: `"blacklisted"` if the listing's URL is in the (active, i.e.
non-`removedAt`) blacklist; else `"filtered"` if it fails any current filter check (exclude
keywords, strata max, excluded property types — all three, per user confirmation); else
`"none"`.

## Session-only reveal tracking

New module `listing-cards/reveal.ts`. A plain in-memory `Set<string>` of listing URLs the
user has clicked "show anyway" on this page session. No `chrome.storage` involvement —
reloading the page or revisiting the search later loses the override and the listing goes
back to being filtered. Exposes `isRevealed(url)`, `reveal(url)`, `unreveal(url)`.

`exclusionReason` computation for a `"filtered"` candidate is suppressed (treated as
`"none"`) when its URL is in the reveal set — i.e. reveal state is applied at the point
`exclusionReason` is computed, not as a separate downstream check.

## Shared collapsed-row component

New module `listing-cards/exclusion-row.ts`, replacing/generalizing the current
`summary.ts`. One component renders the collapsed state for both exclusion reasons — same
rounded horizontal-line look, same structure (icon, label text, action button) — only the
icon/label/action differ:

| Reason | Icon | Action button | Action |
| --- | --- | --- | --- |
| `blacklisted` | bin.svg | "Unblacklist" | `removeBlacklistEntry` (soft-delete, existing behavior unchanged) |
| `filtered` | eye.svg (closed/crossed variant available as `eye-off.svg`) | "Show anyway" | `reveal(url)` |

When a previously-filtered, now-revealed listing should be re-hidden, the *real, expanded*
card shows a small always-visible "eye-off" affordance (using `eye-off.svg`) that calls
`unreveal(url)` — restoring the collapsed row. This is the "add an action to hide filtered
items out again" requirement.

This module also owns the animated expand/collapse transition (see below), so toggling
between collapsed-row and real-card content is one code path regardless of which reason
triggered it. It renders both the standalone single-listing row and (reused, more compactly)
each per-listing line inside an expanded group — see "Consolidated grouping" below.

## Animation mechanics

Generalizes the existing `.edf-listing-card-blacklisted` CSS technique (already used today)
rather than replacing it: the card/slide gets a small `max-height` + `overflow: hidden` when
collapsed, and a large (effectively unbounded) `max-height` when expanded, with a CSS
`transition` on `max-height` (and a touch of `opacity`) driving the animated collapse/expand
on toggle. No JS-measured heights, no layout thrashing — same lightweight approach already
proven in this codebase, just applied uniformly wherever a card/slide collapses now
(standard cards, carousel slides, project cards).

## Consolidated grouping of adjacent excluded top-level cards

Added after the user reviewed the first draft of this spec. When two or more consecutive
top-level list items (`<li>`s in the search-results list — standard cards, whole blacklisted
projects, whole blacklisted/filtered featured-carousel cards; any mix of `blacklisted` and
`filtered` reasons) are excluded, they consolidate into **one** group row instead of one
collapsed row each — e.g. "3 listings hidden" rather than three separate rows stacked
together. This groups by DOM adjacency only, not by reason — a blacklisted card next to a
filtered card next to another blacklisted card is one group of three.

This grouping is a top-level-list concept only. It's unrelated to (and doesn't change) the
existing per-parent aggregation already designed for project children and carousel children
below — those stay nested one level inside their own project/carousel card, never as
siblings in the main list, so they're never candidates for this top-level grouping.

**Interaction, three levels of disclosure:**

1. **Group row** (default state): one collapsed row, e.g. "3 listings hidden", using the
   same visual language as a single exclusion row.
2. **Hovering (or focusing) the group row** expands it *in place* — pushing the rest of the
   list down, not floating over it — into a compact per-listing list: one line per listing
   in the group (address + a small reason indicator: bin or eye icon), each ending in a
   chevron. Leaving the group (mouse-leave/blur) collapses it back to the single group row
   after a short grace period, the same grace-period behavior already agreed on for the
   (now-removed) floating popup design.
3. **Clicking a listing's chevron** expands *that one line* further, in place, to show a
   compact one-line summary (address + reason) plus its action button (Unblacklist / Show
   anyway) — no photo, no features, consistent with keeping the group lightweight. Clicking
   the chevron again collapses that one line back down without acting on it.

**On restore**: clicking the action button removes that listing from the group immediately
(same underlying toggle as a standalone excluded card) and it renders as a real, full card
in its natural position in the results list. The group's count/consolidation updates
accordingly — shrinking by one, or dissolving entirely if it was down to one remaining
member (a "group" of one is just a normal single exclusion row), or disappearing if it was
the last one.

## Behavior by card shape

### Standard cards (and whole project/carousel cards, once excluded)

The excluded card's entire visible content is replaced by the collapsed row, animated in/out
via the mechanism above. Both `blacklisted` and `filtered` reasons use the exact same
treatment here. When adjacent to other excluded top-level cards, they consolidate per the
grouping behavior above instead of each rendering their own standalone row.

### Carousel children (featured/topspot carousel, and project unit carousels)

An individual excluded child does **not** get the "replace with a collapsed row" treatment,
because a slick-carousel slide has externally-managed width/position — collapsing its
*content* to a small row would leave dead space in a fixed-height slide slot rather than
actually shrinking anything.

Instead: **the slide itself shrinks (via CSS) when its listing is excluded**, and returns to
full size when restored. If every child in a given carousel becomes excluded, the whole
carousel card (the `<li>` containing it) hides entirely — no point showing an empty
carousel.

> **Known technical risk, to validate early in implementation**: slick.js computes and
> applies slide positions/track-width via its own JS (inline styles), not by reading live
> CSS from the DOM. We don't have a reference to Domain's slick instance to call its
> `slickRemove`/resize API directly. Shrinking a slide with pure CSS may not cause slick to
> reflow the rest of the track (subsequent slides might not shift to fill the gap). The
> first implementation task for this piece should be a live spike (browser devtools against
> the real site) to determine whether toggling slide width and dispatching a `resize` event
> is enough to get slick to reflow, or whether a different technique is needed. If no clean
> reflow is achievable, the fallback is to accept the visual gap rather than block the
> feature — annotate it as a known limitation if so.

### Whole-bundle-card exclusion (blacklisting an entire project or featured/topspot card)

Both "a project" and "a featured/topspot carousel card" are the same underlying shape for
this purpose: one card that bundles multiple individual listings, blacklistable either as a
whole or per-child. To avoid duplicating this logic between `project.ts` and the new
`carousel.ts`, their shared behavior is extracted into a small shared bundle helper (exact
file TBD during implementation planning — likely `listing-cards/bundle.ts`) that both call
into for: the top-right whole-card blacklist button, and the aggregate "N children
excluded" row.

- **Project**: existing inline "unblacklist icon next to the address" button (built in the
  previous session) continues to serve as the whole-project blacklist toggle. When active,
  the whole project `<li>` collapses via the standard `exclusion-row.ts` treatment (already
  happens today structurally — this spec just removes the popup expectation and switches to
  the animated transition).
- **Featured/topspot carousel**: gains a **new** top-right overlay button (same visual
  treatment/position the project button used before this session's rework) for blacklisting
  the entire card in one action, independent of per-child exclusion.
- **Project children**: individually hidden (not shown as a shrunk slide — they're just
  variant units of one known building, not separate merchandising), with one aggregate
  "N properties blacklisted — Unblacklist all" row using `exclusion-row.ts`'s shared
  component, placed within the project card's own layout (not a separately-styled one-off
  as it is today). No popup, no per-child preview — matches user's stated preference that
  "most of the important information exists on the project itself."
- **Featured/topspot carousel children**: per the "carousel children" behavior above (shrink
  the slide), since these represent genuinely separate, unrelated properties bundled
  together for merchandising, unlike project units.

## Module layout (within `listing-cards/` and `matching/`)

```text
matching/index.ts        — ListingMatch gains exclusionReason; matchedPreferences unchanged
listing-cards/
  card.ts                 — unchanged: selectors, card-kind detection, snapshot extraction
  button.ts                — unchanged: blacklist button clone/class-mirroring
  toggle.ts                — unchanged: blacklist add/remove storage logic
  reveal.ts        (new)   — session-only filter-reveal tracking
  exclusion-row.ts (renamed/generalized from summary.ts)
                            — shared collapsed-row component + animated transition,
                              parameterized by ExclusionReason; also renders the compact
                              per-listing line used inside an expanded group
  exclusion-group.ts (new) — detects adjacent excluded top-level cards, renders/maintains
                              the consolidated group row, owns the hover-expand and
                              per-listing chevron disclosure levels
  bundle.ts         (new)  — shared "whole-card blacklist button" + "aggregate row" logic
                              used by both project.ts and carousel.ts
  carousel.ts       (new)  — featured/topspot-carousel-specific: per-slide shrink/reveal,
                              whole-card button (via bundle.ts), hide-when-all-excluded
  project.ts                — updated to use bundle.ts + exclusion-row.ts instead of its
                              own bespoke summary markup
  ads.ts                    — unchanged
  index.ts                  — orchestration, wires in carousel.ts, exclusion-group.ts, and
                              the new match model
```

Exact file boundaries for `bundle.ts` vs. how much stays in `project.ts`/`carousel.ts` are
left to the implementation plan to finalize once the shared logic is actually written and
its natural seams are visible.

## Error handling

No new error-handling surface beyond what exists today. `getTitle`/`getThumbnailUrl`'s
existing fallback chains are unaffected since listing-snapshot extraction itself isn't
changing — only how the computed `exclusionReason` is rendered changes.

## Explicitly out of scope for this spec

- Whole-extension folder reorganization / general complexity reduction outside
  `listing-cards/` and `matching/` — planned as a separate, later spec.
- Any persistence for filter-reveal state.
- A floating hover-popup preview overlay (considered and rejected in favor of the in-place
  hover-to-expand grouping described above).
