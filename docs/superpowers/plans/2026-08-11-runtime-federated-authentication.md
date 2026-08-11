# Runtime Federated Authentication Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace environment-controlled provider authentication with one app-owned account system that uses mode-safe local/production origins and a hardened Apple/Facebook OAuth bridge while preserving direct Google and email authentication.

**Architecture:** A pure checked-in runtime configuration module supplies the same mode-specific bridge URL and origin policy to the manifest, offscreen document, and hosted bridge. The background account service exposes one provider-neutral API and selects either Chrome Identity or the federated bridge through a provider registry. The hosted page remains a narrow Firebase popup credential bridge and never owns the extension session.

**Tech Stack:** TypeScript, Vite 8, CRXJS Manifest V3, Chrome Identity and Offscreen APIs, Firebase Authentication 12, Firebase Hosting.

## Global Constraints

- Do not add automated test-spec files or introduce a test framework.
- Development bridge URL: `http://127.0.0.1:5174/auth/`.
- Production bridge URL: `https://extra-domain-filters.web.app/auth/`.
- Production extension origin: `chrome-extension://opblibcobnkicpdjkinngfcbjjnjldkg`.
- Development may accept only `chrome-extension://` followed by exactly 32 lowercase letters in the `a` through `p` range.
- Keep Google on Chrome Identity and email/password on `firebase/auth/web-extension`.
- Apple and Facebook share the offscreen hosted bridge.
- Keep the public Firebase Hosting path `/auth/`.
- Never place a Facebook App Secret, Apple private key, or OAuth client secret in source, `.env`, a manifest, or an extension bundle.
- Preserve the user-owned untracked `.vscode/` directory.

---

## File structure

- Create `src/config/authRuntime.ts`: pure provider registry, mode-specific bridge configuration, and extension-origin validation.
- Modify `manifest.config.ts`: consume the shared runtime configuration instead of a helper URL environment key.
- Modify `src/infrastructure/firebase/config.ts`: retain only Firebase web-app configuration.
- Modify `src/domain/account/model.ts`: expose provider transport metadata and app-owned capabilities.
- Modify `src/shared/platform/authBridge.ts`: define and validate both extension-to-offscreen and iframe message contracts once.
- Rename `src/background/federatedAuth.ts` to `src/background/federatedAuthBridge.ts`: own offscreen lifecycle and bridge requests.
- Modify `src/background/account.ts`: use a provider adapter registry and centralized error normalization.
- Modify `src/offscreen/offscreen.ts`: load the bridge from runtime configuration and validate correlated iframe responses.
- Rename `src/auth-helper/` to `src/federated-auth-bridge/`: make the hosted page's narrow responsibility explicit.
- Rename `vite.auth-helper.config.ts` to `vite.federated-auth-bridge.config.ts`: configure both local serving and hosted output.
- Modify `package.json`: add local bridge serving and point bridge scripts/linting at the renamed config.
- Modify `.env.example` and the ignored local `.env`: remove application behavior flags and origins.
- Replace `docs/authentication.md`: document commands, deployment order, and exact Facebook/Apple configuration.

---

### Task 1: Create the single runtime authentication configuration

**Files:**
- Create: `src/config/authRuntime.ts`
- Modify: `src/domain/account/model.ts`
- Modify: `src/infrastructure/firebase/config.ts`
- Modify: `manifest.config.ts`

**Interfaces:**
- Produces: `AuthRuntimeMode`, `FederatedAuthRuntimeConfig`, `ACCOUNT_PROVIDER_TRANSPORTS`, `getFederatedAuthRuntime(mode)`, and `isAllowedExtensionOrigin(origin, mode)`.
- Consumes: Vite's explicit `mode` string and the existing `AccountProvider` union.

- [ ] **Step 1: Add the pure runtime configuration module**

Create `src/config/authRuntime.ts` with explicit modes and no environment reads:

```ts
import type { AccountProvider } from "../domain/account/model";

export type AuthRuntimeMode = "development" | "production";
export type FederatedAuthProvider = Extract<AccountProvider, "apple" | "facebook">;
export type ProviderTransport = "chrome-identity" | "federated-bridge";

export const ACCOUNT_PROVIDER_TRANSPORTS = {
    apple: "federated-bridge",
    facebook: "federated-bridge",
    google: "chrome-identity",
} as const satisfies Record<AccountProvider, ProviderTransport>;

const DEVELOPMENT_BRIDGE_URL = "http://127.0.0.1:5174/auth/";
const PRODUCTION_BRIDGE_URL = "https://extra-domain-filters.web.app/auth/";
const PRODUCTION_EXTENSION_ORIGIN = "chrome-extension://opblibcobnkicpdjkinngfcbjjnjldkg";
const DEVELOPMENT_EXTENSION_ORIGIN = /^chrome-extension:\/\/[a-p]{32}$/;

export interface FederatedAuthRuntimeConfig {
    bridgeOrigin: string;
    bridgeUrl: string;
    mode: AuthRuntimeMode;
}

function readMode(mode: string): AuthRuntimeMode {
    if (mode === "development" || mode === "production") return mode;
    throw new Error(`Unsupported authentication build mode: ${mode}`);
}

export function getFederatedAuthRuntime(mode: string): FederatedAuthRuntimeConfig {
    const resolvedMode = readMode(mode);
    const bridgeUrl = resolvedMode === "development" ? DEVELOPMENT_BRIDGE_URL : PRODUCTION_BRIDGE_URL;
    return { bridgeOrigin: new URL(bridgeUrl).origin, bridgeUrl, mode: resolvedMode };
}

export function isAllowedExtensionOrigin(origin: string, mode: string): boolean {
    const resolvedMode = readMode(mode);
    return resolvedMode === "development"
        ? DEVELOPMENT_EXTENSION_ORIGIN.test(origin)
        : origin === PRODUCTION_EXTENSION_ORIGIN;
}
```

- [ ] **Step 2: Remove feature flags and helper URL parsing from Firebase configuration**

Delete `readFederatedAuthHelperUrl()` and `isFederatedProviderEnabled()` from `src/infrastructure/firebase/config.ts`. Leave `readFirebaseConfig()` as the file's only exported function so this module handles Firebase application identity only.

- [ ] **Step 3: Make supported provider metadata app-owned**

In `src/domain/account/model.ts`, preserve the public `AccountProvider` and `AccountCapabilities` shapes. Re-export the transport type only from `src/config/authRuntime.ts`; do not add UI dependencies on bridge concepts. Capabilities continue to be booleans because they mean “this configured Firebase build supports this app feature,” not “a provider was probed remotely.”

- [ ] **Step 4: Generate manifest permissions from the explicit Vite mode**

In `manifest.config.ts`, import `getFederatedAuthRuntime`, call it inside `defineManifest(({ mode }) => ...)`, and replace all `VITE_FIREBASE_AUTH_HELPER_URL` parsing with:

```ts
const federatedAuth = getFederatedAuthRuntime(mode);
```

Use exactly:

```ts
content_security_policy: {
    extension_pages: `script-src 'self'; object-src 'self'; frame-src ${federatedAuth.bridgeOrigin}`,
},
```

and append `${federatedAuth.bridgeOrigin}/*` to `host_permissions`. Continue loading only `VITE_GOOGLE_OAUTH_CLIENT_ID` from the environment.

- [ ] **Step 5: Verify mode separation**

Run:

```powershell
npm run typecheck
npm run eslint
npx vite build --mode development
Get-Content -Raw dist\manifest.json | Select-String '127.0.0.1:5174'
Get-Content -Raw dist\manifest.json | Select-String 'extra-domain-filters.web.app'
```

Expected: typecheck and ESLint pass; the development manifest contains `127.0.0.1:5174` and does not contain `extra-domain-filters.web.app`.

Then run:

```powershell
npx vite build --mode production
Get-Content -Raw dist\manifest.json | Select-String 'extra-domain-filters.web.app'
Get-Content -Raw dist\manifest.json | Select-String '127.0.0.1:5174'
```

Expected: the production manifest contains `extra-domain-filters.web.app` and does not contain `127.0.0.1:5174`.

- [ ] **Step 6: Commit the runtime configuration**

```powershell
git add src/config/authRuntime.ts src/domain/account/model.ts src/infrastructure/firebase/config.ts manifest.config.ts
git commit -m "refactor: make auth capabilities runtime-owned"
```

---

### Task 2: Consolidate and harden federated bridge messaging

**Files:**
- Modify: `src/shared/platform/authBridge.ts`
- Rename: `src/background/federatedAuth.ts` to `src/background/federatedAuthBridge.ts`
- Modify: `src/offscreen/offscreen.ts`

**Interfaces:**
- Consumes: `FederatedAuthProvider` and `getFederatedAuthRuntime(import.meta.env.MODE)` from Task 1.
- Produces: `OffscreenAuthRequest`, `FederatedAuthPageRequest`, `FederatedAuthResponse`, `isOffscreenAuthRequest()`, `isFederatedAuthPageRequest()`, `isFederatedAuthResponse()`, and `getFederatedCredential()`.

- [ ] **Step 1: Replace duplicate message shapes with one shared contract**

Rewrite `src/shared/platform/authBridge.ts` around these shapes:

```ts
import type { FederatedAuthProvider } from "../../config/authRuntime";
import { isPlainObject } from "../utils/types";

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
```

Add separate validators for the two requests and the response. Both request validators must require a non-empty `requestId`; the offscreen validator must additionally require `target === "offscreen-auth"`.

- [ ] **Step 2: Rename and narrow the background bridge adapter**

Move `src/background/federatedAuth.ts` to `src/background/federatedAuthBridge.ts`. Replace its config import with:

```ts
const { bridgeUrl } = getFederatedAuthRuntime(import.meta.env.MODE);
```

The adapter must continue to allow only one active flow, create the offscreen document on demand, generate `crypto.randomUUID()`, validate the correlated response, and close the offscreen document in `finally`. Remove the obsolete “not configured for this build” URL branch because every supported mode has a checked-in URL.

- [ ] **Step 3: Make the offscreen document use the shared runtime and contracts**

In `src/offscreen/offscreen.ts`, replace the environment read with:

```ts
const { bridgeOrigin, bridgeUrl } = getFederatedAuthRuntime(import.meta.env.MODE);
```

Always create the hidden iframe with `iframe.src = bridgeUrl`. When forwarding the request, create a `FederatedAuthPageRequest` rather than an ad hoc object. Accept a response only when all of these are true:

```ts
event.origin === bridgeOrigin
event.source === iframe.contentWindow
isFederatedAuthResponse(event.data)
event.data.requestId === message.requestId
```

Keep the 90-second timeout and a single idempotent cleanup function. Ensure the iframe load-error path calls `sendResponse` exactly once.

- [ ] **Step 4: Update imports and run static checks**

Replace imports of `./federatedAuth` and old bridge type names across `src/`. Run:

```powershell
rg -n "FederatedAccountProvider|FederatedAuthBridgeRequest|FederatedAuthBridgeResponse|background/federatedAuth|\.\/federatedAuth" src
npm run typecheck
npm run eslint
```

Expected: ripgrep returns no matches; typecheck and ESLint pass.

- [ ] **Step 5: Commit the shared bridge boundary**

```powershell
git add src/shared/platform/authBridge.ts src/background/federatedAuth.ts src/background/federatedAuthBridge.ts src/offscreen/offscreen.ts
git commit -m "refactor: consolidate federated auth bridge"
```

---

### Task 3: Replace provider branching with transport adapters

**Files:**
- Create: `src/background/providerAuth.ts`
- Modify: `src/background/account.ts`
- Modify: `src/domain/account/client.ts`
- Modify: `src/shared/platform/messages.ts`
- Modify: `src/popup/views/login.ts`
- Modify: `src/features/settings/view.ts`

**Interfaces:**
- Consumes: `ACCOUNT_PROVIDER_TRANSPORTS`, `AccountProvider`, and `getFederatedCredential()`.
- Produces: `getProviderCredential(provider): Promise<AuthCredential>` and the existing public `loginWithProvider(provider): Promise<AccountState>` behavior with deterministic capabilities.

- [ ] **Step 1: Extract provider credential acquisition**

Create `src/background/providerAuth.ts`. Move `getGoogleAccessToken()` out of `account.ts`, retain its current Chrome Identity authorization URL and scopes, and expose one transport-selected function:

```ts
import { GoogleAuthProvider, OAuthCredential, type AuthCredential } from "firebase/auth/web-extension";

import { ACCOUNT_PROVIDER_TRANSPORTS, type ProviderTransport } from "../config/authRuntime";
import type { AccountProvider } from "../domain/account/model";
import { getFederatedCredential } from "./federatedAuthBridge";

async function getGoogleCredential(): Promise<AuthCredential> {
    return GoogleAuthProvider.credential(null, await getGoogleAccessToken());
}

async function getBridgeCredential(provider: "apple" | "facebook"): Promise<AuthCredential> {
    const credential = OAuthCredential.fromJSON(await getFederatedCredential(provider));
    if (!credential || credential.providerId !== `${provider}.com`) {
        throw new Error("The login provider returned the wrong credential type.");
    }
    return credential;
}

type ProviderAdapter = (provider: AccountProvider) => Promise<AuthCredential>;

const PROVIDER_ADAPTERS = {
    "chrome-identity": async provider => {
        if (provider !== "google") throw new Error("Invalid Chrome Identity provider.");
        return getGoogleCredential();
    },
    "federated-bridge": async provider => {
        if (provider === "google") throw new Error("Invalid federated bridge provider.");
        return getBridgeCredential(provider);
    },
} satisfies Record<ProviderTransport, ProviderAdapter>;

export function getProviderCredential(provider: AccountProvider): Promise<AuthCredential> {
    return PROVIDER_ADAPTERS[ACCOUNT_PROVIDER_TRANSPORTS[provider]](provider);
}
```

Use an exhaustive transport/provider branch so adding a provider produces a TypeScript error until its adapter is implemented.

- [ ] **Step 2: Make capabilities deterministic**

Replace `getCapabilities()` in `src/background/account.ts` with:

```ts
function getCapabilities(configured: boolean): AccountState["capabilities"] {
    return {
        apple: configured,
        emailPassword: configured,
        facebook: configured,
        google: configured && Boolean(chrome.runtime.getManifest().oauth2?.client_id),
    };
}
```

Remove every import and branch tied to provider enable flags or the bridge URL.

- [ ] **Step 3: Simplify provider sign-in**

In `loginWithProvider()`, replace the Google/federated conditional with:

```ts
const credential = await getProviderCredential(provider);
return toState((await signInWithCredential(services.auth, credential)).user);
```

Preserve the Firebase-configured guard and capability guard. Change `authError()` to accept an optional `AccountProvider`, call `authError(error, provider)` from this flow, and continue calling it without a provider from email flows.

- [ ] **Step 4: Improve stable error messages**

Keep the existing mapping and add these exact fallbacks:

```ts
"auth/network-request-failed": "Authentication could not reach the server. Check your connection and try again.",
"auth/user-disabled": "This account has been disabled.",
```

Handle `auth/operation-not-allowed` before the static map so provider sign-in returns:

```ts
const label = provider ? `${provider[0].toUpperCase()}${provider.slice(1)}` : "This";
return new Error(`${label} login is supported by the extension but is not enabled in Firebase yet.`);
```

In `FederatedAuthError`, preserve bridge codes. If its code is not in the static map, return `new Error(error.message)` so bridge timeout and availability details are not replaced by the generic login failure.

- [ ] **Step 5: Confirm all callers remain provider-neutral**

Keep the public message and client method name `loginWithProvider(provider)`. In `src/popup/views/login.ts`, all three provider buttons continue using this method and derive visibility only from `AccountState.capabilities`. In `src/features/settings/view.ts`, Google continues through the same client API; it must not import Chrome Identity or bridge code.

- [ ] **Step 6: Run static checks and inspect removed branches**

```powershell
rg -n "isFederatedProviderEnabled|readFederatedAuthHelperUrl|VITE_APPLE_AUTH_ENABLED|VITE_FACEBOOK_AUTH_ENABLED" src manifest.config.ts
npm run check:all
npm run build
```

Expected: ripgrep returns no matches and all checks/builds pass.

- [ ] **Step 7: Commit provider orchestration**

```powershell
git add src/background/providerAuth.ts src/background/account.ts src/domain/account/client.ts src/shared/platform/messages.ts src/popup/views/login.ts src/features/settings/view.ts
git commit -m "refactor: unify account provider orchestration"
```

---

### Task 4: Rename and secure the hosted federated bridge

**Files:**
- Rename: `src/auth-helper/index.html` to `src/federated-auth-bridge/index.html`
- Rename: `src/auth-helper/main.ts` to `src/federated-auth-bridge/main.ts`
- Rename: `vite.auth-helper.config.ts` to `vite.federated-auth-bridge.config.ts`
- Modify: `package.json`

**Interfaces:**
- Consumes: `getFederatedAuthRuntime(import.meta.env.MODE)`, `isAllowedExtensionOrigin()`, `FederatedAuthPageRequest`, and `FederatedAuthResponse`.
- Produces: a local bridge at `http://127.0.0.1:5174/auth/` and production assets in `hosting/auth`.

- [ ] **Step 1: Rename the hosted source without changing its public path**

Move the two files from `src/auth-helper/` to `src/federated-auth-bridge/`. Update the HTML module script path if necessary. Keep Vite's `base: "/auth/"` and output directory `hosting/auth`.

- [ ] **Step 2: Replace hosted-page origin environment logic**

In the renamed `main.ts`, remove the local `HostedAuthRequest` interface and `readRequest()`. Use the shared validator and runtime policy:

```ts
const runtime = getFederatedAuthRuntime(import.meta.env.MODE);

window.addEventListener("message", event => {
    if (event.source !== window.parent) return;
    if (!isAllowedExtensionOrigin(event.origin, runtime.mode)) return;
    if (!isFederatedAuthPageRequest(event.data)) return;
    void handleAuth(event.data, event.origin);
});
```

Keep provider creation, minimal scopes, in-memory persistence, credential serialization, and Firebase sign-out. `handleAuth()` must respond to the validated `event.source` window passed as an argument instead of reaching for an unchecked global target.

- [ ] **Step 3: Configure a strict loopback development server**

Rename the Vite config and update it to:

```ts
export default defineConfig({
    base: "/auth/",
    envDir: repositoryRoot,
    root: resolve(repositoryRoot, "src/federated-auth-bridge"),
    server: {
        host: "127.0.0.1",
        port: 5174,
        strictPort: true,
    },
    build: {
        emptyOutDir: true,
        outDir: resolve(repositoryRoot, "hosting/auth"),
        sourcemap: false,
    },
});
```

- [ ] **Step 4: Update package scripts and lint targets**

Use these scripts in `package.json`:

```json
"dev:auth-helper": "vite --config vite.federated-auth-bridge.config.ts",
"build:auth-helper": "vite build --config vite.federated-auth-bridge.config.ts",
"deploy:auth-helper": "npm run build:auth-helper && npx firebase-tools deploy --only hosting"
```

Replace `vite.auth-helper.config.ts` with `vite.federated-auth-bridge.config.ts` in both ESLint scripts. Script-only package metadata does not require a lockfile rewrite.

- [ ] **Step 5: Verify the local and production bridge builds**

Run the local server:

```powershell
npm run dev:auth-helper
```

Expected: Vite binds only `http://127.0.0.1:5174/` and reports `/auth/` as the configured base. Stop the server after confirming the page responds at `http://127.0.0.1:5174/auth/`.

Then run:

```powershell
npm run build:auth-helper
Get-ChildItem -Recurse hosting\auth
rg -n "PRIVATE KEY|APP_SECRET|VITE_EXTENSION_ORIGIN|VITE_FIREBASE_AUTH_HELPER_URL" hosting\auth
```

Expected: `hosting/auth/index.html` and bundled assets exist; ripgrep finds no secret markers or removed environment keys.

- [ ] **Step 6: Commit the hosted bridge replacement**

```powershell
git add src/auth-helper src/federated-auth-bridge vite.auth-helper.config.ts vite.federated-auth-bridge.config.ts package.json
git commit -m "refactor: harden hosted federated auth bridge"
```

---

### Task 5: Remove obsolete environment keys and replace authentication documentation

**Files:**
- Modify: `.env.example`
- Modify locally, do not commit: `.env`
- Modify: `docs/authentication.md`
- Modify if referenced: `README.md`

**Interfaces:**
- Consumes: final commands, URLs, origins, and errors from Tasks 1–4.
- Produces: one accurate setup path for local development, Firebase Hosting, Meta, and Apple Developer.

- [ ] **Step 1: Remove application behavior from environment templates**

Delete these lines from `.env.example` and the ignored local `.env` while preserving all Firebase web-app values and `VITE_GOOGLE_OAUTH_CLIENT_ID`:

```text
VITE_FIREBASE_AUTH_HELPER_URL
VITE_EXTENSION_ORIGIN
VITE_APPLE_AUTH_ENABLED
VITE_FACEBOOK_AUTH_ENABLED
```

Do not print or commit the remaining local `.env` values.

- [ ] **Step 2: Replace the baseline and local-development documentation**

Rewrite `docs/authentication.md` so it starts with the transport table and then gives this order:

1. Copy `.env.example` to `.env` and fill only Firebase public web-app values plus the Google OAuth client ID.
2. Run `npm run dev:auth-helper`.
3. Run `npm run dev` in a second terminal.
4. Load the unpacked extension and confirm its development manifest allows only `http://127.0.0.1:5174/*` for the bridge.
5. Enable Email/Password, Google, Facebook, and Apple in Firebase Authentication as each external provider is configured.

In the Firebase baseline, instruct the developer to add the exact unpacked `chrome-extension://<extension-id>` origin under Authentication > Settings > Authorized domains for local work, and the production origin `chrome-extension://opblibcobnkicpdjkinngfcbjjnjldkg` before release. Explain that Apple and Facebook buttons represent app support; `auth/operation-not-allowed` means the selected provider still needs enabling in Firebase.

- [ ] **Step 3: Document the exact Facebook setup**

Include the following project-specific values:

```text
App domain: extra-domain-filters.firebaseapp.com
Valid OAuth Redirect URI: https://extra-domain-filters.firebaseapp.com/__/auth/handler
```

Document Meta app creation, Facebook Login, Client OAuth Login, Web OAuth Login, Firebase App ID/App Secret entry, tester roles during development, and live-mode privacy/data-use requirements. State explicitly that the App Secret is stored in Firebase Console only and that the hosted `/auth/` page is not Meta's redirect URI.

- [ ] **Step 4: Document the exact Apple setup**

Include the following project-specific values:

```text
Website domain: extra-domain-filters.firebaseapp.com
Return URL: https://extra-domain-filters.firebaseapp.com/__/auth/handler
```

Document the primary App ID, Services ID association, Sign in with Apple key, Team ID, Key ID, private key entry in Firebase, private email relay registration, and the production account-deletion/token-revocation requirement. State explicitly that the private key is stored in Firebase Console only.

- [ ] **Step 5: Document production deployment and troubleshooting**

Use this production order:

```powershell
npm run build:auth-helper
npx firebase-tools deploy --only hosting
npx vite build --mode production
```

Require checking `https://extra-domain-filters.web.app/auth/` before packaging the extension. Add a troubleshooting table for provider disabled, popup closed/blocked, unauthorized domain, bridge timeout, local bridge unavailable, and redirect mismatch.

- [ ] **Step 6: Scan configuration and documentation for stale keys**

```powershell
rg -n "VITE_(APPLE_AUTH_ENABLED|FACEBOOK_AUTH_ENABLED|EXTENSION_ORIGIN|FIREBASE_AUTH_HELPER_URL)" --glob '!node_modules/**' --glob '!dist/**' --glob '!hosting/**' --glob '!release/**' --glob '!docs/superpowers/**'
```

Expected: no results. Confirm `.env` remains ignored with `git status --short`.

- [ ] **Step 7: Commit configuration and documentation**

```powershell
git add .env.example docs/authentication.md README.md
git commit -m "docs: consolidate federated auth setup"
```

If `README.md` was not changed, omit it from the `git add` command.

---

### Task 6: Complete cross-mode verification and cleanup

**Files:**
- Modify only if verification exposes a defect: files owned by Tasks 1–5.

**Interfaces:**
- Consumes: the complete runtime configuration, account service, bridge, scripts, and documentation.
- Produces: a clean branch whose development and production artifacts enforce different origins without environment switches.

- [ ] **Step 1: Run all repository checks**

```powershell
npm run check:all
npm run build:auth-helper
npx vite build --mode development
npx vite build --mode production
```

Expected: every command exits successfully.

- [ ] **Step 2: Inspect production artifacts for mode and secret leakage**

```powershell
Get-Content -Raw dist\manifest.json
rg -n "127.0.0.1:5174|PRIVATE KEY|APP_SECRET|VITE_APPLE_AUTH_ENABLED|VITE_FACEBOOK_AUTH_ENABLED|VITE_EXTENSION_ORIGIN|VITE_FIREBASE_AUTH_HELPER_URL" dist hosting\auth
```

Expected: the manifest contains only `https://extra-domain-filters.web.app` for the bridge; ripgrep finds none of the forbidden strings.

- [ ] **Step 3: Manually verify local authentication behavior**

With `npm run dev:auth-helper` and `npm run dev` running, reload the unpacked extension and verify:

- email account creation sends a verification email;
- email login, password reset, sign-out, and session restoration work;
- Google sign-in still uses Chrome Identity and completes without the bridge;
- Apple and Facebook open their Firebase popup through the bridge;
- closing a popup returns control without leaving buttons busy;
- a disabled Firebase provider shows the new actionable error;
- stopping the bridge server produces a bridge-unavailable error within the bounded flow;
- a second provider click while a flow is active is rejected without opening another popup.

- [ ] **Step 4: Review final code consolidation**

Run:

```powershell
rg -n "signInWithPopup" src
rg -n "launchWebAuthFlow" src
rg -n "getFederatedAuthRuntime" src manifest.config.ts
git status --short
git diff --check HEAD~5..HEAD
```

Expected: `signInWithPopup` exists only in the hosted bridge; `launchWebAuthFlow` exists only in the Google adapter; runtime configuration consumers are manifest, offscreen, background bridge, and hosted bridge; `.vscode/` remains untouched.

- [ ] **Step 5: Commit any verification fixes**

If verification required code changes, stage only those scoped files and commit:

```powershell
git commit -m "fix: complete federated auth verification"
```

If no changes were required, do not create an empty commit.
