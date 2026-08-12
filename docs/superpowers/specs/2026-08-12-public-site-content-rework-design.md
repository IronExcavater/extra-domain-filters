# Public Site Content Rework Design

## Goal

Rework the public site (`src/site`, built by `npm run dev:site` / `build:site`) so its long-form content is authored in markdown instead of TypeScript object literals, its "last updated" dates are explicit and trustworthy, and the landing page reads as a genuine product page rather than a placeholder: real screenshots, a live version/changelog trail, an FAQ, and a fuller feature breakdown. This is a follow-up to `2026-08-12-public-website-legal-pages-design.md`, which shipped the initial static site; that design's visual system (fonts, colours, motion) and page shell are unchanged and still apply.

## Scope

In scope:

- Move Privacy, Terms and Data Deletion content from `src/site/content.ts` into markdown files.
- Add a changelog: one markdown file, a new `/changelog/` route, and a "What's new" section on the landing page.
- Show the extension's current version on the site, sourced from `package.json` at build time (the same source `manifest.config.ts` already uses) — no runtime fetch, no staleness risk.
- Replace the landing page's fake CSS mockup with real screenshots of the extension running on domain.com.au.
- Add an FAQ section and expand the current three-item capability list into a fuller feature breakdown.

Out of scope (unchanged from the prior design, reaffirmed here after investigation):

- Live Chrome Web Store rating, review count, or install count. There is no public API for this — the Chrome Management API's `customers.apps.web` endpoint some marketplaces reference is scoped to a Google Workspace customer's *own managed fleet* (`chrome.management.appdetails.readonly`, keyed by `customers/{customer_id}`), not public storefront stats. The only path to that data is scraping our own listing's `aggregateRating` markup on a schedule, which is fragile and out of scope here.
- Pre-rendered/SSG output. The site stays a client-rendered SPA as today; only the content source changes.
- A CMS, server endpoints, or anything beyond the existing static Firebase Hosting model.

## Content Pipeline

### File layout

```
src/site/content/
  legal/
    privacy.md
    terms.md
    data-deletion.md
  changelog.md
```

Each legal file starts with frontmatter, then body content as standard markdown headings/paragraphs/lists:

```markdown
---
title: Privacy Policy
updated: 2026-08-12
intro: This Privacy Policy explains how Extra Domain Filters handles personal information...
---

## Who we are

Extra Domain Filters is operated by Niclas Rogulski...
```

`##` headings become sections; each is slugified into an anchor id (matching the existing sidebar table-of-contents behaviour) using the same kebab-case scheme the current hardcoded ids already follow (e.g. `information-we-collect`).

`changelog.md` is a single file, Keep-a-Changelog style — one `##` heading per release, followed by a bullet list:

```markdown
## 1.1.0 — 2026-08-12

- Added the public product site and legal pages.
- Fixed a blacklist restore bug on fresh install.
```

### Parsing

Two new dependencies: `marked` (markdown → HTML) and `gray-matter` (frontmatter extraction). Both are small, actively maintained, and dependency-free themselves. Markdown files are imported as raw text via Vite's built-in `?raw` import suffix (no build plugin needed) and parsed client-side at render time, consistent with the site's existing pattern of building HTML strings in `main.ts`.

A new `src/site/markdown.ts` module wraps this:

```ts
interface ParsedSection { body: string; id: string; title: string; }
interface ParsedDocument { frontmatter: Record<string, string>; sections: ParsedSection[]; }

function parseDocument(raw: string): ParsedDocument;
```

`sections[].body` is already-safe HTML (marked output from our own trusted, author-controlled files — not user input), so `content.ts`'s current `escapeHtml`-per-paragraph approach is dropped in favour of injecting the rendered HTML directly, the same way the rest of the page is assembled today.

### Date stamping

Each legal file's frontmatter carries `updated: YYYY-MM-DD`, set by hand whenever the content actually changes. No build-time enforcement — trusted the same way the rest of the site's content already is. The page's existing "Last updated: {date}" line reads this field per-page instead of the current single hardcoded `EFFECTIVE_DATE` shared across all three pages, so each legal page can carry its own accurate date going forward.

## Site Structure Changes

### Routing

`SiteRoute` gains `/changelog/`. `normalizeSiteRoute` and the render switch in `main.ts` extend to handle it alongside the existing legal routes; layout follows the same shell/footer pattern as the legal pages (a single reading column, no sidebar TOC needed since entries are chronological, not cross-referenced).

### Landing page

- **Screenshots**: the hero's fake CSS mockup is replaced with real screenshots of the extension running on domain.com.au (filter panel, a matched listing, the blacklist view), captured by loading the built extension into a real Chrome instance and navigating to live search results. If a clean, representative screenshot isn't practically obtainable during implementation, the existing CSS mockup stays as a fallback rather than blocking the rest of this work.
- **What's new**: a compact section listing the 3 most recent changelog entries (parsed from `changelog.md`), linking to `/changelog/` for full history. Shows the current version (from `package.json`) alongside it.
- **FAQ**: a new section, static Q&A authored directly in `content.ts` (short structured content, no markdown needed) — free to use, not affiliated with Domain Group, what permissions are required, browser support.
- **Feature breakdown**: the current three-item `capabilities` list expands into a fuller section (still TS-authored, still one landing-page section — not a new route) with more detail per feature area.

The landing page's own copy (hero, capabilities, FAQ) stays TypeScript-authored, not markdown — it's structured marketing layout rather than prose, and moving it to markdown would add indirection without simplifying anything.

## Verification

- `npm run check:all` (typecheck/eslint/stylelint) stays clean.
- All routes (`/`, `/privacy/`, `/terms/`, `/data-deletion/`, `/changelog/`) resolve correctly in both `npm run dev:site` and a production Firebase Hosting build.
- Each legal page displays its own frontmatter `updated` date; changelog entries render in reverse-chronological order with the version stat matching `package.json`.
- Screenshots (if captured) are real, current, and don't show stale UI states.
- Desktop and mobile layouts checked with browser screenshots, matching the existing visual system.
