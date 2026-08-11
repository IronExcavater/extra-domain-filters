# Simplified Authentication Development Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make one `npm run dev` command start the extension and authentication Vite servers while replacing the approved auth-related filenames and scripts with shorter, consistent names.

**Architecture:** Keep the extension and hosted authentication page as independent Vite processes, then orchestrate their existing npm scripts with `concurrently`. Rename only the authentication configuration, hosted page, background adapters, and message-contract files; public URLs, runtime behavior, and security policies remain unchanged.

**Tech Stack:** Node.js, npm, TypeScript, Vite 8, CRXJS Manifest V3, Firebase Authentication 12, `concurrently`.

## Global Constraints

- Do not add automated test-spec files or introduce a test framework.
- Preserve `http://127.0.0.1:5174/auth/` for local authentication.
- Preserve `https://extra-domain-filters.web.app/auth/` for production authentication.
- Preserve Firebase Hosting output at `hosting/auth` and the public `/auth/` path.
- Preserve the production extension origin `chrome-extension://opblibcobnkicpdjkinngfcbjjnjldkg`.
- Keep environment configuration unchanged; removed auth enable/origin variables must not return.
- Rename only the six approved auth files/directories and their active references.
- Keep historical records under `docs/superpowers/` unchanged except for this plan.
- Preserve the user-owned untracked `.vscode/` directory.

---

## File structure

- Rename `vite.federated-auth-bridge.config.ts` to `vite.auth.config.ts`: Vite configuration for local and hosted auth-page builds.
- Rename `src/federated-auth-bridge/` to `src/auth/`: hosted Firebase popup page.
- Rename `src/config/authRuntime.ts` to `src/config/auth.ts`: auth modes, URLs, transports, and origin policy.
- Rename `src/background/federatedAuthBridge.ts` to `src/background/authBridge.ts`: offscreen lifecycle and credential bridge.
- Rename `src/background/providerAuth.ts` to `src/background/authProviders.ts`: provider credential adapters.
- Rename `src/shared/platform/authBridge.ts` to `src/shared/platform/authMessages.ts`: bridge request/response contracts.
- Modify `package.json` and `package-lock.json`: dependency, combined development command, and simplified auth scripts.
- Modify `README.md` and `docs/authentication.md`: combined startup and individual diagnostic commands.

---

### Task 1: Rename the authentication modules and configuration

**Files:**
- Rename: `vite.federated-auth-bridge.config.ts` to `vite.auth.config.ts`
- Rename: `src/federated-auth-bridge/index.html` to `src/auth/index.html`
- Rename: `src/federated-auth-bridge/main.ts` to `src/auth/main.ts`
- Rename: `src/config/authRuntime.ts` to `src/config/auth.ts`
- Rename: `src/background/federatedAuthBridge.ts` to `src/background/authBridge.ts`
- Rename: `src/background/providerAuth.ts` to `src/background/authProviders.ts`
- Rename: `src/shared/platform/authBridge.ts` to `src/shared/platform/authMessages.ts`
- Modify: `manifest.config.ts`
- Modify: `vite.config.ts`
- Modify: `src/offscreen/offscreen.ts`
- Modify: `src/background/account.ts`
- Modify: all renamed modules whose relative imports change
- Modify: `package.json`

**Interfaces:**
- Preserves: `getFederatedAuthRuntime()`, `getBundledFederatedAuthRuntime()`, `isAllowedExtensionOrigin()`, `getFederatedCredential()`, `getProviderCredential()`, and all auth message types and validators.
- Changes: import paths and Vite config/source-root paths only.

- [ ] **Step 1: Apply the six approved renames**

Move file contents without changing exported symbols or behavior. The final tree must contain:

```text
vite.auth.config.ts
src/auth/index.html
src/auth/main.ts
src/config/auth.ts
src/background/authBridge.ts
src/background/authProviders.ts
src/shared/platform/authMessages.ts
```

The old paths must no longer exist.

- [ ] **Step 2: Update TypeScript imports**

Replace active imports using these exact path mappings:

```text
../config/authRuntime                 -> ../config/auth
../../config/authRuntime              -> ../../config/auth
./federatedAuthBridge                 -> ./authBridge
./providerAuth                        -> ./authProviders
../shared/platform/authBridge         -> ../shared/platform/authMessages
../../shared/platform/authBridge      -> ../../shared/platform/authMessages
```

Keep imported symbol names unchanged; filenames become simpler without creating API churn.

- [ ] **Step 3: Update both Vite configurations**

In `vite.config.ts`, import runtime auth configuration from:

```ts
import { getFederatedAuthRuntime } from './src/config/auth';
```

In `vite.auth.config.ts`, use:

```ts
import { getFederatedAuthRuntime } from "./src/config/auth";
```

and set the hosted source root to:

```ts
root: resolve(repositoryRoot, "src/auth"),
```

Do not change `base`, server host/port, `hosting/auth`, build constants, or sourcemap behavior.

- [ ] **Step 4: Update the HTML entry point**

Keep `src/auth/index.html` loading the colocated module:

```html
<script type="module" src="./main.ts"></script>
```

No public URL or page copy changes are required.

- [ ] **Step 5: Update auth scripts and lint targets for the renamed config**

Before verification, update `package.json` so the auth scripts and lint targets follow the renamed config while the default `dev` script remains `vite`:

```json
"dev": "vite",
"dev:auth": "vite --config vite.auth.config.ts",
"build:auth": "vite build --config vite.auth.config.ts",
"deploy:auth": "npm run build:auth && npx firebase-tools deploy --only hosting"
```

Delete `dev:auth-helper`, `build:auth-helper`, and `deploy:auth-helper`. Replace `vite.federated-auth-bridge.config.ts` with `vite.auth.config.ts` in `eslint` and `eslint:fix`.

- [ ] **Step 6: Verify the rename is behavior-neutral**

Run:

```powershell
npm run typecheck
npm run eslint -- --no-error-on-unmatched-pattern
npx vite build --config vite.auth.config.ts --mode production --logLevel error
npx vite build --mode production --logLevel error
```

Expected: all commands exit successfully; `hosting/auth/index.html` and `dist/manifest.json` are generated.

Scan active source and root configuration:

```powershell
rg -n "federated-auth-bridge|authRuntime|federatedAuthBridge|providerAuth|platform/authBridge|vite\.federated-auth-bridge" src manifest.config.ts vite.config.ts vite.auth.config.ts
```

Expected: no results.

- [ ] **Step 7: Commit the bounded rename**

```powershell
git add package.json manifest.config.ts vite.config.ts vite.auth.config.ts vite.federated-auth-bridge.config.ts src/auth src/federated-auth-bridge src/config src/background src/offscreen/offscreen.ts src/shared/platform
git commit -m "refactor: simplify auth module names"
```

---

### Task 2: Add the combined development command

**Files:**
- Modify: `package.json`
- Modify: `package-lock.json`

**Interfaces:**
- Produces: combined `npm run dev` and individual `npm run dev:extension`.
- Consumes: `dev:auth`, `build:auth`, `deploy:auth`, and `vite.auth.config.ts` from Task 1.

- [ ] **Step 1: Install the process orchestrator**

Run:

```powershell
npm install --save-dev concurrently
```

Expected: `concurrently` appears under `devDependencies`; `package-lock.json` records the exact resolved dependency graph.

- [ ] **Step 2: Replace the development and auth scripts**

Change the default development script and add the individual extension script:

```json
"dev": "concurrently --kill-others-on-fail --names extension,auth \"npm run dev:extension\" \"npm run dev:auth\"",
"dev:extension": "vite"
```

Do not duplicate or rename the `dev:auth`, `build:auth`, and `deploy:auth` scripts established in Task 1.

- [ ] **Step 3: Verify the individual commands**

Start `npm run dev:auth`, request `http://127.0.0.1:5174/auth/`, and confirm HTTP 200. Stop only the verified workspace Vite process. Start `npm run dev:extension`, confirm `dist/manifest.json` is generated in development mode, then stop only that verified workspace Vite process.

Expected: each command starts independently and terminates without leaving a workspace-owned Vite process.

- [ ] **Step 4: Verify combined startup and labeled output**

Start:

```powershell
npm run dev
```

Expected output includes both `[extension]` and `[auth]` prefixes. Confirm:

```powershell
Invoke-WebRequest -UseBasicParsing -Uri "http://127.0.0.1:5174/auth/"
```

Expected: HTTP 200 while the extension development build is also active.

Interrupt the parent command. Verify no workspace-owned Vite process remains and no process is listening on port `5174`.

- [ ] **Step 5: Verify child-failure coordination**

Start `npm run dev:auth` by itself so port `5174` is occupied. In a second process, run `npm run dev`.

Expected: the combined auth child exits because the strict port is unavailable; `concurrently` terminates its extension child and the combined parent exits non-zero. Stop the original verified `dev:auth` process and confirm port `5174` is free.

- [ ] **Step 6: Run static and build checks**

```powershell
npm run check:all
npm run build:auth
npx vite build --mode development --logLevel error
npx vite build --mode production --logLevel error
```

Expected: all commands exit successfully.

- [ ] **Step 7: Commit the development workflow**

```powershell
git add package.json package-lock.json
git commit -m "build: run extension and auth development together"
```

---

### Task 3: Update active documentation and complete verification

**Files:**
- Modify: `README.md`
- Modify: `docs/authentication.md`

**Interfaces:**
- Consumes: final script names from Task 2.
- Produces: one documented default startup command plus individual diagnostic commands.

- [ ] **Step 1: Simplify README development startup**

Keep `npm run dev` as the only required start command in the manual developer installation. Add one sentence explaining that it starts both the extension and local auth server. Do not require a second terminal.

- [ ] **Step 2: Update the authentication guide**

Replace the two-terminal instructions with:

```sh
npm run dev
```

Document these optional diagnostic commands:

```sh
npm run dev:extension
npm run dev:auth
```

Replace build/deploy commands with:

```sh
npm run build:auth
npm run deploy:auth
```

Keep provider-console instructions, URLs, origins, secrets guidance, and troubleshooting behavior unchanged. Update the local-bridge troubleshooting row to reference `npm run dev:auth`.

- [ ] **Step 3: Scan active code and documentation for stale names**

Run:

```powershell
rg -n "dev:auth-helper|build:auth-helper|deploy:auth-helper|vite\.federated-auth-bridge|src/federated-auth-bridge|authRuntime|federatedAuthBridge|providerAuth|platform/authBridge" package.json README.md docs/authentication.md src manifest.config.ts vite.config.ts vite.auth.config.ts
```

Expected: no results. Historical documents under `docs/superpowers/` are intentionally excluded.

- [ ] **Step 4: Run final cross-mode artifact verification**

Run:

```powershell
npm run check:all
npx vite build --config vite.auth.config.ts --mode development --logLevel error
npx vite build --config vite.auth.config.ts --mode production --logLevel error
npx vite build --mode development --logLevel error
npx vite build --mode production --logLevel error
```

Verify the development manifests/artifacts contain `127.0.0.1:5174` and exclude `extra-domain-filters.web.app`; verify production artifacts contain `extra-domain-filters.web.app` and exclude `127.0.0.1:5174`.

Scan final production artifacts for:

```text
PRIVATE KEY
APP_SECRET
VITE_APPLE_AUTH_ENABLED
VITE_FACEBOOK_AUTH_ENABLED
VITE_EXTENSION_ORIGIN
VITE_FIREBASE_AUTH_HELPER_URL
```

Expected: no matches.

- [ ] **Step 5: Verify repository state**

Run:

```powershell
git diff --check
git status --short
```

Expected: no unexpected changes; `.vscode/` remains the only preserved untracked path before documentation is staged.

- [ ] **Step 6: Commit documentation**

```powershell
git add README.md docs/authentication.md
git commit -m "docs: simplify local auth development"
```
