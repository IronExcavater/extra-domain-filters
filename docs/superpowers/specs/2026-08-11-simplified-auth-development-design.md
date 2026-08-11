# Simplified Authentication Development Design

Date: 2026-08-11

Status: Approved design, awaiting written-spec review

Branch: `chore/simplify-auth-dev`

## Context

Local authentication development currently requires two terminals: the main
extension Vite server is started with `npm run dev`, while the hosted Firebase
popup bridge is started separately with `npm run dev:auth-helper`. The helper's
current internal names are accurate but unnecessarily long and inconsistent:
some use “federated auth bridge,” some use “auth helper,” and others use
“runtime auth.”

This change makes the normal development command start both processes and
replaces the mixed terminology with a short, consistent `auth` vocabulary.

## Goals

- Make `npm run dev` start the extension and local authentication server
  together.
- Keep individual development scripts for isolated debugging.
- Stop the sibling process when either development server fails so the command
  cannot leave a partially working environment behind.
- Give concurrent output stable `extension` and `auth` labels.
- Simplify auth-related filenames, directories, imports, scripts, and docs.
- Preserve all authentication behavior, security boundaries, build-mode
  isolation, hosted URLs, and output paths.

## Non-goals

- Renaming unrelated feature, domain, page, UI, or infrastructure files.
- Changing Firebase Authentication behavior or provider configuration.
- Changing the production extension ID, bridge origin, local port, or hosted
  `/auth/` route.
- Introducing a custom process manager or new test framework.
- Adding automated test-spec files.

## Approaches considered

### 1. `concurrently` with a targeted auth rename — selected

Use the established cross-platform `concurrently` package to run two named npm
scripts. Rename only the files and commands involved in authentication startup
and transport. This gives one reliable entry point without adding custom
process-management code or causing repository-wide churn.

### 2. Combine scripts without renaming files

This is smaller, but preserves the current mix of `auth-helper`,
`federated-auth-bridge`, and `authRuntime` terminology. It does not address the
requested naming cleanup.

### 3. Rename ambiguous files across the repository

This would touch many unrelated imports and feature boundaries without helping
the combined development workflow. The review and regression surface would be
disproportionate to the benefit.

## Package scripts

Add `concurrently` as a development dependency and replace the development
scripts with:

```json
{
  "dev": "concurrently --kill-others-on-fail --names extension,auth \"npm:dev:extension\" \"npm:dev:auth\"",
  "dev:extension": "vite",
  "dev:auth": "vite --config vite.auth.config.ts",
  "build:auth": "vite build --config vite.auth.config.ts",
  "deploy:auth": "npm run build:auth && npx firebase-tools deploy --only hosting"
}
```

`npm run dev` becomes the documented default. `dev:extension` and `dev:auth`
remain available when only one server or one log stream is needed.

If either child exits with an error, `concurrently` terminates the other child
and returns a failing status. Interrupting the parent command terminates the
group. The labels make interleaved Vite messages attributable without adding
custom formatting code.

The old `dev:auth-helper`, `build:auth-helper`, and `deploy:auth-helper` aliases
are removed rather than retained as duplicate compatibility scripts. This is a
developer-only command change and all in-repository references will be updated
atomically.

## File and directory names

Apply this bounded rename set:

| Current | Replacement | Responsibility |
| --- | --- | --- |
| `vite.federated-auth-bridge.config.ts` | `vite.auth.config.ts` | Local and hosted auth-page Vite configuration |
| `src/federated-auth-bridge/` | `src/auth/` | Hosted Firebase popup page |
| `src/config/authRuntime.ts` | `src/config/auth.ts` | Checked-in auth modes, URLs, transports, and origin policy |
| `src/background/federatedAuthBridge.ts` | `src/background/authBridge.ts` | Offscreen bridge lifecycle and credential request |
| `src/background/providerAuth.ts` | `src/background/authProviders.ts` | Google and bridge credential adapters |
| `src/shared/platform/authBridge.ts` | `src/shared/platform/authMessages.ts` | Validated offscreen and iframe message contracts |

The shorter names remain responsibility-specific: `auth.ts` is configuration,
`authProviders.ts` selects credentials, `authBridge.ts` manages the offscreen
transport, and `authMessages.ts` owns message schemas. No generic `utils` or
catch-all auth module is introduced.

The following public or generated paths do not change:

- development auth URL: `http://127.0.0.1:5174/auth/`;
- production auth URL: `https://extra-domain-filters.web.app/auth/`;
- Firebase Hosting output: `hosting/auth`;
- extension offscreen page: `src/offscreen/offscreen.html`;
- Firebase callback: `https://extra-domain-filters.firebaseapp.com/__/auth/handler`.

## Configuration and documentation updates

- Update Vite roots, ESLint targets, imports, and package scripts to the new
  names.
- Update `README.md` so `npm run dev` is the only required local-start command.
- Update `docs/authentication.md` to describe the combined default and the two
  individual diagnostic commands.
- Replace active references to the old filenames and npm scripts. Historical
  design and implementation records under `docs/superpowers/` remain unchanged
  because they describe the repository state at the time they were written.
- Keep environment configuration unchanged; the removed auth enable/origin
  keys must not reappear.

## Failure behavior

- A busy auth port causes the auth process to fail and the extension process to
  terminate through `--kill-others-on-fail`.
- A Vite configuration or compilation failure terminates the sibling process
  and returns a non-zero parent status.
- Normal Ctrl+C shutdown stops both children.
- Individual scripts retain their normal Vite behavior and exit codes.
- No retry loop is added; port and configuration errors require developer
  action and should remain visible.

## Verification

No automated test-spec files or new test framework will be added. Verification
will cover:

- dependency installation and lockfile consistency;
- `npm run check:all`;
- `npm run dev` starts both labeled processes;
- the extension development server builds `dist`;
- `http://127.0.0.1:5174/auth/` returns HTTP 200;
- interrupting the combined command leaves no listener on port `5174`;
- `npm run dev:extension` and `npm run dev:auth` still start independently;
- `npm run build:auth` creates `hosting/auth`;
- development and production extension builds retain mutually exclusive auth
  origins;
- production artifact scans contain no localhost auth URL, removed environment
  key, private-key marker, or app-secret marker;
- source and active documentation contain no old filename or script reference;
- the user-owned `.vscode/` directory remains untouched.

## Acceptance criteria

- One `npm run dev` command starts both required local Vite processes.
- Logs identify their `extension` or `auth` source.
- A child failure does not leave the other server running.
- Each server remains runnable through its individual script.
- All six approved auth filename/directory renames are complete.
- Old helper script names and active references are removed.
- Public auth routes and security configuration remain unchanged.
- Static checks, auth build, and both extension build modes pass.
