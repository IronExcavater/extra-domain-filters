# Account and Provider Configuration Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Deliver a complete login/create-account/password-reset experience with working Google, Apple, and Facebook Firebase authentication plus safe provider-configuration guidance.

**Architecture:** The background owns the persistent extension Firebase session. Email/password calls use `firebase/auth/web-extension`; Google keeps the working Chrome Identity path. Apple/Facebook use a Firebase-hosted standard-web helper proxied through one MV3 offscreen document, returning serialized OAuth credentials for the background to reconstruct.

**Tech Stack:** Firebase Auth 12, Chrome MV3 Identity/Offscreen APIs, TypeScript, Vite, Firebase Hosting.

## Global Constraints

- Packages 1 and 2 must be complete first.
- Do not add automated test specifications, test files, or a test framework.
- Never persist or log passwords, Apple private keys, Meta app secrets, or OAuth tokens.
- Google sign-in must remain working.
- Provider UI appears only when its configuration flag and required URL/client ID exist.
- Authentication failures must avoid email-account enumeration.

---

### Task 1: Expand the account model and message contract

**Files:**
- Modify: `src/domain/account/model.ts`
- Modify: `src/domain/account/client.ts`
- Modify: `src/shared/platform/messages.ts`
- Modify: `src/background/background.ts`

**Interfaces:**
- Produces: account provider capabilities and validated auth request variants.

- [ ] **Step 1: Define provider capabilities**

```ts
export type AccountProvider = "apple" | "facebook" | "google";

export interface AccountCapabilities {
    apple: boolean;
    emailPassword: boolean;
    facebook: boolean;
    google: boolean;
}

export interface AccountState {
    capabilities: AccountCapabilities;
    configured: boolean;
    profile?: AccountProfile;
    status: "signed-in" | "signed-out" | "unavailable";
}
```

- [ ] **Step 2: Add exact requests**

Add `account:login-email`, `account:create-email`, `account:reset-password`, and
`account:login-provider`. Validate email strings, password strings with a 4096-character
upper bound, and provider membership before dispatch.

- [ ] **Step 3: Add client methods**

```ts
loginWithEmail(email: string, password: string): Promise<AccountState>;
createAccount(email: string, password: string): Promise<AccountState>;
sendPasswordReset(email: string): Promise<void>;
loginWithProvider(provider: AccountProvider): Promise<AccountState>;
```

Keep `signIn()` as a temporary Google compatibility wrapper until all consumers migrate.

- [ ] **Step 4: Verify and commit**

Run `npm run typecheck && npm run eslint`, then commit.

### Task 2: Implement email/password and provider-neutral background auth

**Files:**
- Rewrite: `src/background/account.ts`
- Modify: `src/infrastructure/firebase/client.ts`
- Modify: `src/features/settings/view.ts`
- Modify: `src/popup/components/navigation.ts`

- [ ] **Step 1: Add direct Firebase methods**

Import `createUserWithEmailAndPassword`, `sendPasswordResetEmail`, and
`signInWithEmailAndPassword` from `firebase/auth/web-extension`. Return `AccountState` from
login/create and `void` from reset.

- [ ] **Step 2: Centralize safe error translation**

Map invalid credentials to "Email or password is incorrect.", weak password to the
configured password-policy message, cancellation to a neutral result, and provider/config
errors to actionable setup messages. Do not distinguish registered from unregistered email
in login or reset copy.

- [ ] **Step 3: Migrate settings and navigation consumers**

Use `loginWithProvider("google")` from all Google entry points and display the capability
state rather than hard-coded "Google account" assumptions.

- [ ] **Step 4: Verify and commit**

Run `npm run check:all`; manually verify existing Google login and sign-out; commit.

### Task 3: Build the hosted Apple/Facebook auth helper

**Files:**
- Create: `src/auth-helper/index.html`
- Create: `src/auth-helper/main.ts`
- Create: `vite.auth-helper.config.ts`
- Modify: `package.json`
- Modify: `firebase.json`
- Modify: `.env.example`
- Modify: `src/vite-env.d.ts`

**Interfaces:**
- Consumes message: `{ requestId: string; provider: "apple" | "facebook"; type: "edf-auth:start" }`.
- Produces message: `{ credential?: object; error?: string; requestId: string; type: "edf-auth:result" }`.

- [ ] **Step 1: Add a standalone helper build**

Configure Vite with root `src/auth-helper`, output `hosting/auth`, empty the output directory,
resolve the output from the repository root, and add scripts `build:auth-helper` and
`deploy:auth-helper`. Include `vite.auth-helper.config.ts` in the existing ESLint scripts.

- [ ] **Step 2: Implement the helper flow**

Initialize Firebase from the existing public `VITE_FIREBASE_*` keys. On a validated parent
message, use `OAuthProvider("apple.com")` with `email` and `name` scopes or
`FacebookAuthProvider` with `email`, call `signInWithPopup`, extract the provider credential,
call `credential.toJSON()`, and post it only to the configured extension origin with the
same request ID. Require `event.source === parent` and an exact
`VITE_EXTENSION_ORIGIN` match before starting auth. Set the helper Auth instance to
`inMemoryPersistence` before sign-in and sign it out after serializing the credential so
the hosted helper retains no Firebase session.

- [ ] **Step 3: Configure hosting**

Add a hosting target with public directory `hosting`, ignore source-map files, and rewrite
`/auth/**` to `/auth/index.html`. Do not add cache persistence for the helper page.

- [ ] **Step 4: Add non-secret config keys**

Add `VITE_FIREBASE_AUTH_HELPER_URL=`, `VITE_EXTENSION_ORIGIN=`,
`VITE_APPLE_AUTH_ENABLED=false`, and `VITE_FACEBOOK_AUTH_ENABLED=false` to `.env.example`
and `src/vite-env.d.ts`. The extension origin is the exact stable
`chrome-extension://<extension-id>` origin and is not a wildcard.

- [ ] **Step 5: Verify and commit**

Run `npm run build:auth-helper`; inspect `hosting/auth` for secrets and source maps; commit.

### Task 4: Add the MV3 offscreen credential proxy

**Files:**
- Create: `src/offscreen/auth.html`
- Create: `src/offscreen/auth.ts`
- Create: `src/background/federatedAuth.ts`
- Modify: `manifest.config.ts`
- Modify: `src/background/account.ts`
- Modify: `src/background/background.ts`

**Interfaces:**
- Produces: `signInWithFederatedProvider(provider): Promise<AccountState>`.

- [ ] **Step 1: Configure manifest permissions and CSP**

Add `offscreen`. When the helper URL is configured, add its origin to `host_permissions` and
`content_security_policy.extension_pages` `frame-src`; reject invalid/non-HTTPS helper URLs
at build configuration time.

- [ ] **Step 2: Implement one serialized offscreen flow**

Use a module-level promise to create at most one offscreen document. Embed exactly the
configured helper URL, accept Chrome messages targeted to `edf-auth-offscreen`, generate a
cryptographic request ID, enforce a 90-second timeout, and validate both event origin and
request ID before responding.

- [ ] **Step 3: Reconstruct credentials in the background**

For Apple use `OAuthProvider.credentialFromJSON`; for Facebook deserialize with
`OAuthProvider.credentialFromJSON` and assert `providerId === "facebook.com"`. Call
`signInWithCredential` on the extension Auth instance and close the offscreen document in
`finally`.

- [ ] **Step 4: Verify and commit**

Run `npm run check:all && npm run build`; confirm manifest permission/CSP output in
`dist/manifest.json`; commit.

### Task 5: Rebuild the popup login/create-account UI

**Files:**
- Rename: `src/popup/views/signIn.ts` to `src/popup/views/login.ts`
- Modify: `src/popup/model.ts`
- Modify: `src/popup/popup.ts`
- Modify: `src/popup/styles/views.css`
- Modify: `src/popup/components/navigation.ts`
- Modify: `src/shared/ui/icons.ts`

- [ ] **Step 1: Rename the view state**

Replace popup view `"sign-in"` with `"login"` and preserve a `returnView` so success/back
returns to the originating surface.

- [ ] **Step 2: Build Log in and Create account modes**

Use semantic forms with email/password fields, create-mode password confirmation,
show/hide controls, inline validation, inline `role="alert"`, submit busy state, and a mode
switch. Use the heading "Log in".

- [ ] **Step 3: Add password recovery and provider buttons**

Forgot password uses the entered email and always shows the same confirmation on a resolved
request. Add equal-width Google/Apple/Facebook buttons below an "or continue with" divider,
filtered by `AccountCapabilities`.

- [ ] **Step 4: Verify and commit**

Run `npm run check:all`. Manually verify field validation, confirmation mismatch, login,
create account, password reset, provider cancellation, provider failure, success return,
and responsive layout; commit.

### Task 6: Document and perform provider configuration

**Files:**
- Modify: `README.md`
- Modify: `.env.example`

- [ ] **Step 1: Document Firebase prerequisites**

Add exact console paths for enabling Email/Password, adding the Chrome extension and helper
domains to Authorized domains, and finding Firebase's OAuth handler URL:
`https://<project-id>.firebaseapp.com/__/auth/handler`.

- [ ] **Step 2: Document Meta app setup**

Cover creating a Consumer app, adding Facebook Login for Web, entering the Firebase handler
as a valid OAuth redirect URI, supplying App ID/App Secret in Firebase Authentication,
adding privacy policy/data deletion URLs for production, and switching the Meta app live
only after test-account verification.

- [ ] **Step 3: Document Apple setup**

Cover Services ID, website domain/return URL, Sign in with Apple key, Team ID/Key ID/private
key entry in Firebase, private email relay registration, and the requirement that the key
never enters `.env`.

- [ ] **Step 4: Deploy with the user**

Run `firebase login` only if no active CLI session exists, then
`npm run build:auth-helper` and `firebase deploy --only hosting`. Place the resulting HTTPS
helper URL in the local `.env`, enable Apple/Facebook flags after their console setup, and
rebuild the extension.

- [ ] **Step 5: Final provider verification**

Run `npm run check:all && npm run build`. Manually complete Google, email login, email account
creation, reset, Apple, Facebook, sign-out, popup reopen, and sync-session persistence.
Commit documentation/config fixes with `git commit -m "docs: configure account providers"`.
