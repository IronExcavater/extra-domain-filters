# src/ Apps and Shared Restructure Design

## Goal

Restructure `src/` so the codebase's actual shape is visible from its folders: three independent apps (the extension, the auth bridge, the public site) each own their app-specific code, and a slim `shared/` contains only what's genuinely used by more than one app. Fix the naming collision this surfaced along the way (`src/domain/` vs `src/shared/domain/` mean two unrelated things today) and the `FEDERATED`-prefixed identifiers in `config/auth.ts` that repeat information the file's own name already carries.

This is purely a reorganisation and rename — no behavioural change. It's sequenced before the already-approved `2026-08-12-public-site-content-rework-design.md` so that work lands on the settled structure instead of getting moved again immediately after.

## Investigation findings

Cross-app usage was traced by grepping actual imports, not assumed from folder names:

- Only **4 files** are genuinely imported by more than one app: `config/auth.ts` (extension + auth bridge + vite configs), `config/links.ts` (extension settings view + site), `infrastructure/firebase/config.ts`'s `readFirebaseConfig` (extension + auth bridge), and `shared/platform/authMessages.ts` (extension background/offscreen + auth bridge — the postMessage protocol between them).
- Everything else currently under `src/shared/`, `src/domain/`, `src/features/`, `src/pages/`, `src/popup/`, `src/background/`, `src/offscreen/`, `src/app/` is extension-only.
- `src/shared/domain/` is not related to `src/domain/`. The former holds helpers for reading **Domain.com.au's own page DOM** (its nav menus, filters, listing cards — used by `features/` and `pages/` to interact with the site being extended). The latter is this app's own business-domain model (account, blacklist, listings, sync, telemetry). Same word, two unrelated meanings, one nested inside the other.
- `firebase/client.ts` and `firebase/syncCollection.ts` (the actual SDK wiring — `firebase/auth/web-extension`, `firebase/firestore/lite`) are extension-only; only the env-var-reading `readFirebaseConfig` is shared with the auth bridge.
- The `@` → `/src` alias already declared in `vite.config.ts` is unused anywhere in the codebase — dead config, removed as part of this work rather than carried forward.

## Target Structure

```
src/
  apps/
    extension/
      background/, offscreen/, popup/          (unchanged internals)
      content/            ← renamed from app/ (content-script router entry; "app" was ambiguous with 3 apps in the repo)
      pages/, features/, domain/                 (unchanged — confirmed extension-only)
      site-dom/           ← renamed from shared/domain/ (Domain.com.au page-DOM helpers; removes the collision with domain/)
      infrastructure/firebase/                    ← client.ts + syncCollection.ts (SDK wiring, extension-only)
      platform/, ui/, utils/, state/, collections/, dom/   ← renamed from shared/* (all confirmed extension-only)
    auth/                  (was src/auth, unchanged internally)
    site/                  (was src/site, unchanged internally)
  shared/
    config/
      auth.ts              (moved from src/config/auth.ts; FEDERATED-prefix cleanup, see below)
      links.ts              (moved from src/config/links.ts, unchanged)
      firebase.ts            (readFirebaseConfig, moved from infrastructure/firebase/config.ts)
    authMessages.ts          (moved from shared/platform/authMessages.ts)
```

### FEDERATED naming cleanup (`shared/config/auth.ts`)

The whole file is already scoped to the federated-auth-bridge concern by its name and location, so identifiers inside it don't need to repeat "Federated":

| Current | New |
|---|---|
| `FederatedAuthRuntimeConfig` | `AuthRuntimeConfig` |
| `getFederatedAuthRuntime()` | `getAuthRuntime()` |
| `getBundledFederatedAuthRuntime()` | `getBundledAuthRuntime()` |
| `FederatedAuthProvider` | stays — it distinguishes Apple/Facebook from Google/email at call sites outside this file, where the qualifier is meaningful |
| `__FEDERATED_AUTH_MODE__` / `__FEDERATED_AUTH_BRIDGE_URL__` (Vite `define` globals) | `__AUTH_BRIDGE_MODE__` / `__AUTH_BRIDGE_URL__` |

`shared/authMessages.ts`'s `isFederatedAuthPageRequest`, `FederatedAuthPageRequest`, `FederatedAuthResponse` keep their names — that file's messages travel between the extension and multiple contexts, so "federated" is doing real disambiguating work there, not just repeating the filename.

## Migration Approach

Directory moves via `git mv` preserve internal relative imports automatically between files that move together — only two categories of import need edits:

1. **`shared/` prefix removal**: paths like `../../shared/ui/elements` become `../../ui/elements` for everything reclassified as extension-only (same relative depth, just the `shared` segment drops since e.g. `shared/ui` becomes `apps/extension/ui` — both one level under their new parent).
2. **The 4 true cross-app imports**: get a new `@shared` path alias instead of relative paths, so they don't depend on counting `../` through the new nesting. Added to `vite.config.ts`, `vite.auth.config.ts`, `vite.site.config.ts` (`resolve.alias`) and to `tsconfig.json` (`compilerOptions.paths`) so both bundling and IDE/tsc resolution work. The existing unused `@` → `/src` alias is removed rather than kept alongside.

Sequence:

1. `git mv` `background/`, `offscreen/`, `popup/`, `pages/`, `features/`, `domain/`, `app/`→`content/`, and the extension-only parts of `shared/*` (renamed per the table above) into `apps/extension/`.
2. `git mv` `auth/` → `apps/auth/`, `site/` → `apps/site/`.
3. Consolidate the 4 cross-app files into the new slim `shared/config/` and `shared/authMessages.ts`; delete the now-empty old `config/`, `infrastructure/` and `shared/platform/` locations.
4. Add the `@shared` alias to all three Vite configs and `tsconfig.json`; rewrite the 4 cross-app import sites to use it.
5. Mechanical `shared/` prefix fixup across everything moved into `apps/extension/`.
6. Update `vite.config.ts` / `vite.auth.config.ts` / `vite.site.config.ts` roots, and every literal path string in `manifest.config.ts` (`service_worker`, `default_popup`, all `content_scripts.js`/`.css` entries, `web_accessible_resources`) to the new `apps/extension/...` locations.
7. Apply the FEDERATED naming cleanup in `shared/config/auth.ts` and its ~4 call sites.

## Verification

- `tsc --noEmit` after each major move step — the codebase is fully typed, so this reliably catches every import left pointing at an old path before moving on to the next step.
- `npm run check:all` (typecheck + eslint + stylelint) clean at the end.
- `npm run build`, `npm run build:auth`, `npm run build:site` all succeed.
- `npm run dev` boots all three dev servers (extension, auth, site) cleanly, matching the current baseline.
- Manual smoke check: load the built `dist/` as an unpacked extension in Chrome and confirm it still activates on a domain.com.au search page (content script, popup, and background all still wire up correctly after the manifest path changes).
