# Runtime Authentication and Federated OAuth Bridge Design

Date: 2026-08-11

Status: Proposed, awaiting final review

Branch: `refactor/domain-extension-refresh`

## Context

The extension currently exposes Apple and Facebook sign-in through build-time
`VITE_*_AUTH_ENABLED` switches. It also requires environment variables for the
hosted authentication helper URL and extension origin. Those values describe
application behavior and deployment topology, not secrets or operator-specific
configuration. Keeping them in `.env` makes local and production builds easy to
misconfigure and causes authentication capabilities to vary invisibly.

Google sign-in already works through Chrome Identity. Apple and Facebook use an
offscreen extension document plus a hosted Firebase page because Manifest V3
does not allow the remote Firebase authentication code needed by
`signInWithPopup` to execute in the extension itself.

This design replaces the scattered flags and provider-specific entry points
with one app-owned provider registry and a small transport boundary. It retains
the different transports where the browser and providers require them.

## Goals

- Make email/password, Google, Facebook, and Apple visible through one stable
  account API.
- Remove provider enable flags, helper URL, and extension origin from the
  environment.
- Select safe development and production helper configuration from the Vite
  build mode.
- Keep Google on the working Chrome Identity path.
- Rename and simplify the hosted helper so its role as an OAuth credential
  bridge is unambiguous.
- Make provider failures actionable without inventing a second source of truth
  for Firebase provider configuration.
- Document the complete Facebook and Apple setup for this Firebase project.
- Reduce duplicated provider branching and message validation.

## Non-goals

- Replacing Firebase Authentication.
- Sending provider secrets to the extension or committing them to the repo.
- Building a custom Apple authorization-code backend.
- Moving Google through the hosted bridge merely to make all transports look
  identical internally.
- Adding a new automated test framework or test-spec files.

## Decision

Use a hybrid transport architecture behind one provider-neutral account API.

| Provider | User-facing capability | Authentication transport |
| --- | --- | --- |
| Email/password | Sign up and sign in | Firebase Auth Web Extension SDK |
| Google | Sign in | Chrome Identity, then Firebase credential sign-in |
| Facebook | Sign in | Offscreen document plus hosted federated OAuth bridge |
| Apple | Sign in | Offscreen document plus hosted federated OAuth bridge |

The account layer owns orchestration, results, and errors. A checked-in
provider registry declares which providers the application supports and which
transport each uses. UI code asks the account layer for capabilities and does
not read environment variables or know about offscreen documents.

Firebase remains the source of truth for whether Facebook or Apple is enabled
and correctly configured for the deployed project. The extension will show
app-supported providers consistently. If Firebase rejects a provider with
`auth/operation-not-allowed`, the account layer converts that to a clear setup
error rather than silently hiding the provider through another flag.

## Why the hosted bridge remains

Firebase's Manifest V3 guidance supports email/password and credential-based
sign-in directly with `firebase/auth/web-extension`, but popup and redirect
methods require an offscreen document that embeds a normal hosted web page.
The hosted page can load the standard Firebase Auth SDK, complete the provider
popup, and return only the resulting credential material to the extension.

The bridge is therefore not a second authentication system. It is a narrow
browser compatibility boundary for Apple and Facebook. Removing it while
keeping Firebase popup flows would break the supported Manifest V3 design.

## Why Google remains direct

Google already authenticates successfully through `chrome.identity` and then
signs in to Firebase with a Google credential. Routing it through the hosted
page would add iframe, popup, network, hosting, and origin-policy dependencies
without adding capability. Consolidation happens at the account API and result
contract; transports remain purpose-specific.

## Proposed modules and responsibilities

Names may be adjusted to match nearby conventions during implementation, but
the boundaries are fixed.

### Runtime authentication configuration

A checked-in, pure configuration module will own:

- supported providers and their transport;
- development and production bridge URLs;
- the production extension ID/origin;
- helper-origin and parent-origin validation functions;
- build-mode selection with no ambient fallback.

The same configuration will be consumed by the manifest generator, background
account code, and hosted bridge build. This prevents manifest permissions and
runtime URLs from drifting apart.

### Account service

The account service exposes transport-neutral operations such as:

- `getAuthCapabilities()`;
- `signInWithProvider(provider)`;
- `signInWithEmail(credentials)`;
- `signUpWithEmail(credentials)`;
- `signOut()` and current-account state.

Provider-specific code is selected through the registry. Shared result and
error normalization occurs once at this boundary.

### Direct provider adapters

- The Google adapter owns Chrome Identity and Google-to-Firebase credential
  conversion.
- The email adapter owns Firebase email/password sign-in and sign-up.

Neither adapter knows about the hosted bridge.

### Federated OAuth bridge

One adapter supports both Apple and Facebook. It owns:

- offscreen document lifecycle;
- correlation IDs and request timeouts;
- typed extension/offscreen/iframe messages;
- strict source and origin checks;
- reconstruction of the returned Firebase credential;
- cleanup after completion or failure.

The hosted page only accepts supported federated provider IDs, opens the
Firebase popup, serializes the minimum credential result, and sends one
correlated response to its validated parent.

## Development and production modes

| Concern | Development | Production |
| --- | --- | --- |
| Vite mode | `development` | `production` |
| Bridge URL | `http://127.0.0.1:5174/auth/` | `https://extra-domain-filters.web.app/auth/` |
| Accepted parent | Any syntactically valid unpacked Chrome extension origin | Exact published extension origin |
| Manifest host permission | `http://127.0.0.1:5174/*` | `https://extra-domain-filters.web.app/*` |
| CSP frame source | Local bridge origin only | Production bridge origin only |

The production extension origin is:

`chrome-extension://opblibcobnkicpdjkinngfcbjjnjldkg`

Development accepts only an origin matching Chrome's extension scheme and ID
shape: `chrome-extension://` followed by exactly 32 lowercase letters in the
`a` through `p` range. It does not accept arbitrary web origins. This permits
unpacked builds whose generated IDs differ between machines while keeping the
development exception limited to the local bridge server.

The local helper server binds to `127.0.0.1` on port `5174` with a strict port.
An `npm run dev:auth-helper` script starts it. Production builds never receive
the localhost host permission or frame source.

## Environment configuration

Remove these keys from code, `.env.example`, local environment documentation,
and all build logic:

- `VITE_APPLE_AUTH_ENABLED`
- `VITE_FACEBOOK_AUTH_ENABLED`
- `VITE_EXTENSION_ORIGIN`
- `VITE_FIREBASE_AUTH_HELPER_URL`

Keep the Firebase public web application configuration and Google OAuth client
ID as environment values because they identify externally registered apps and
can differ by deployment. OAuth client secrets, Apple private keys, and provider
secrets must never enter a `VITE_*` variable, bundle, manifest, or repo.

## Authentication flows

### Email sign-up and sign-in

1. The UI submits normalized email/password input to the account service.
2. The email adapter calls the Firebase Web Extension SDK.
3. The service returns the same account/session shape used by provider sign-in.
4. Firebase errors are mapped to stable, user-readable messages.

### Google

1. The account service selects the Google adapter.
2. Chrome Identity completes Google's authorization flow.
3. The adapter creates a Firebase Google credential.
4. Firebase persists the extension session.

### Facebook and Apple

1. The account service selects the federated bridge adapter.
2. The background ensures the packaged offscreen document exists.
3. The offscreen document loads the mode-specific bridge URL in an iframe.
4. A correlated request names only an allowed provider.
5. The bridge validates the parent origin and message source, then opens the
   Firebase provider popup.
6. The bridge returns serialized credential material to the offscreen document.
7. The background validates the response, reconstructs the credential, and
   signs into Firebase's Web Extension SDK.
8. All listeners and pending requests are removed on success, error, or timeout.

## Message and security rules

- Each request has an unpredictable correlation ID.
- All message payloads are discriminated and validated before use.
- `event.source` must be the expected window, not merely a matching origin.
- The offscreen document accepts messages only from its configured bridge
  origin.
- The production bridge accepts only the exact published extension origin.
- The development bridge accepts only a valid extension origin and is served
  only from loopback.
- Only Apple and Facebook provider identifiers are accepted by the bridge.
- No Firebase session, OAuth client secret, Apple private key, or Facebook app
  secret is transmitted to or stored by extension code.
- Popups must begin from a user gesture, have a finite timeout, and cannot leave
  orphaned pending requests.

## Errors and capabilities

Capabilities describe what this application build supports, not a live probe of
the Firebase Console. A provider-discovery request on every login render would
add latency, rate-limit exposure, and another failure mode without replacing
Firebase as configuration authority.

The account layer will normalize at least these cases:

- provider not configured (`auth/operation-not-allowed`);
- popup closed or cancelled;
- popup blocked;
- account exists with another credential;
- invalid email/password and email already in use;
- network unavailable;
- bridge unavailable or timed out;
- bridge origin/configuration mismatch.

Setup errors should name the provider and direct the developer to the auth
setup documentation. User cancellations remain quiet and recoverable.

## Facebook OAuth setup

The Firebase project is the credential broker, so Facebook's app secret belongs
in Firebase Console, never in the extension.

1. In Meta for Developers, create or select the app and add Facebook Login (or
   the equivalent Facebook authentication use case shown by the current Meta
   console).
2. In the app's basic settings, provide the app name, support/contact email,
   privacy-policy URL, data-deletion instructions URL, and the app domain
   `extra-domain-filters.firebaseapp.com` where requested.
3. In Facebook Login settings, enable Client OAuth Login and Web OAuth Login.
4. Add this exact Valid OAuth Redirect URI:

   `https://extra-domain-filters.firebaseapp.com/__/auth/handler`

   If Firebase's `authDomain` is later changed to a custom domain, register that
   domain's `/__/auth/handler` URL instead and update Firebase configuration as
   one deployment change.
5. In Firebase Console, open Authentication > Sign-in method > Facebook,
   enable it, and paste the Meta App ID and App Secret.
6. While the Meta app is in development mode, add each real tester as an app
   role/tester and have them accept the invitation.
7. Before public release, complete Meta's current business verification, data
   use, review, privacy, and live-mode requirements that apply to the requested
   permissions. The extension should request only the basic identity scopes it
   actually uses.

The hosted bridge URL itself is not the OAuth redirect URI. Firebase owns the
redirect handler above and returns the completed credential to the bridge SDK.

## Apple OAuth setup

Apple web sign-in uses a Services ID associated with a primary App ID. The
Apple private key belongs in Firebase Console only.

1. In Apple Developer Certificates, Identifiers & Profiles, create or select a
   primary App ID and enable Sign in with Apple.
2. Create a Services ID for the web authentication client, enable Sign in with
   Apple, and associate it with the primary App ID.
3. Configure the Services ID website settings with:

   - Domain: `extra-domain-filters.firebaseapp.com`
   - Return URL:
     `https://extra-domain-filters.firebaseapp.com/__/auth/handler`

4. Create a Sign in with Apple key for the primary App ID and securely record
   the Team ID, Key ID, and downloaded private key. Apple permits the private
   key download only once.
5. In Firebase Console, open Authentication > Sign-in method > Apple, enable
   it, and enter the Services ID, Apple Team ID, Key ID, and private key.
6. Configure Apple's private email relay for the Firebase-generated sender
   addresses/domains before sending account or alert email to users who choose
   Hide My Email.
7. Before production release, implement and document the account-deletion and
   Apple token-revocation behavior required for apps offering Sign in with
   Apple. This is a release requirement and is separate from basic login.

As with Facebook, if Firebase's authentication domain changes, the Apple
website domain and return URL must change with it.

## Scripts, naming, and documentation changes

- Add `dev:auth-helper` for the fixed local bridge server.
- Keep a production helper build/deploy command for Firebase Hosting.
- Rename ambiguous `auth-helper` concepts in code toward `federated-auth-bridge`
  where doing so does not conflict with the existing deployed `/auth/` path.
- Keep `/auth/` as the public hosting path to avoid an unnecessary deployment
  migration.
- Update `.env.example` to contain only external app configuration.
- Replace existing auth documentation with the mode table, commands, provider
  console setup, deployment order, and troubleshooting errors in this spec.

## Migration and cleanup

Implementation will remove:

- all reads and branches for the two provider-enabled environment flags;
- environment parsing for bridge URL and extension origin;
- duplicate provider branching in background handlers and UI capability code;
- any helper terminology or module that implies it owns the extension session;
- stale documentation instructing developers to toggle providers in `.env`.

Existing email/password and Google flows will be preserved behind the new
account interface. Apple and Facebook retain the current MV3 offscreen mechanism
but share stricter messages, validation, error mapping, and lifecycle handling.

## Verification

No new automated test-spec files or test framework will be added. Verification
will use the project's existing static and build checks plus focused manual
flows:

- type checking, linting, extension build, and hosted bridge build;
- inspect development and production manifests to confirm mutually exclusive
  host permissions and CSP frame sources;
- confirm no removed environment key remains in source or docs;
- email sign-up, email sign-in, sign-out, and session restoration;
- Google sign-in regression check;
- Facebook and Apple success, cancellation, provider-disabled, bridge-down, and
  wrong-origin behavior;
- local unpacked extension against `127.0.0.1:5174`;
- production package against only the published extension origin and hosted
  bridge.

## Acceptance criteria

- Provider support is declared once in checked-in application code.
- No auth enable flag, helper URL, or extension origin is required in `.env`.
- Development and production packages contain only their own bridge origin.
- UI and background callers use one account/provider API.
- Google retains Chrome Identity; Apple and Facebook use one hardened bridge.
- Provider secrets remain outside the repository and extension bundle.
- Facebook and Apple setup can be completed from the project documentation.
- Existing project checks and both development/production builds pass.
