# Authentication setup

The extension uses one Firebase Authentication account across every login method. Provider support is owned by application code and no longer depends on enable flags in `.env`.

| Method | Extension transport |
| --- | --- |
| Email/password | Firebase Auth Web Extension SDK |
| Google | Chrome Identity, converted to a Firebase credential |
| Apple | Shared offscreen federated-authentication bridge |
| Facebook | Shared offscreen federated-authentication bridge |

The bridge is not a second account system. It exists because Manifest V3 requires Firebase popup authentication to run on a normal hosted page. The extension receives the provider credential and persists the real session itself.

## Local configuration

Copy `.env.example` to `.env` and fill in only the Firebase public web-app configuration and Google OAuth client ID:

```env
VITE_FIREBASE_API_KEY=
VITE_FIREBASE_AUTH_DOMAIN=
VITE_FIREBASE_PROJECT_ID=
VITE_FIREBASE_STORAGE_BUCKET=
VITE_FIREBASE_MESSAGING_SENDER_ID=
VITE_FIREBASE_APP_ID=
VITE_FIREBASE_MEASUREMENT_ID=
VITE_GOOGLE_OAUTH_CLIENT_ID=
```

These values identify registered public applications. Never add a Facebook App Secret, Apple private key, or another OAuth client secret to `.env`; Vite variables are bundled into client code.

Start the extension and local authentication server together:

```sh
npm run dev
```

The auth server binds only to `http://127.0.0.1:5174/auth/` with a strict port. The combined command labels the two log streams `extension` and `auth` and stops the extension server if auth startup fails.

For isolated diagnostics, either process can still be started by itself:

```sh
npm run dev:extension
npm run dev:auth
```

Load `dist` as an unpacked Chrome extension. Development builds allow only the loopback bridge origin. Production builds allow only `https://extra-domain-filters.web.app`.

## Firebase baseline

1. In Firebase Console, select the `extra-domain-filters` project.
2. Open **Authentication > Sign-in method** and enable **Email/Password**. Leave email-link authentication off unless it is intentionally implemented later.
3. Under **Authentication > Settings > Authorized domains**, add the exact origin shown for the unpacked extension on `chrome://extensions`, for example `chrome-extension://<32-character-extension-id>`.
4. Before release, add the production extension origin:

   ```text
   chrome-extension://opblibcobnkicpdjkinngfcbjjnjldkg
   ```

5. Configure a password policy of at least eight characters and enable email-enumeration protection before launch.
6. Customize the verification and password-reset messages under **Authentication > Templates**. Email account creation already sends Firebase's verification email.

Apple and Facebook remain visible when the Firebase app is configured because they are supported application features. If one has not been enabled in Firebase yet, the extension reports that provider-specific setup error instead of hiding the button through a second flag.

## Google

Google remains on Chrome Identity because this path works without the hosted bridge.

1. In Google Cloud Console, configure the OAuth consent screen for the same project.
2. Create a Chrome Extension OAuth client using the production extension ID `opblibcobnkicpdjkinngfcbjjnjldkg`.
3. Put that public client ID in `VITE_GOOGLE_OAUTH_CLIENT_ID`.
4. Enable Google under **Firebase Authentication > Sign-in method**.

For an unpacked extension with a different ID, use a development Chrome Extension OAuth client registered to that exact ID.

## Facebook OAuth

Facebook's App Secret is stored in Firebase Console only. It must not be placed in this repository or extension environment.

1. Open [Meta for Developers](https://developers.facebook.com/apps/), create an app for authenticating users, and add **Facebook Login** or the equivalent authentication use case in the current Meta console.
2. In the app's basic settings, provide its public name, contact email, privacy-policy URL, data-deletion instructions URL, and this app domain where requested:

   ```text
   extra-domain-filters.firebaseapp.com
   ```

3. In **Facebook Login > Settings**, enable **Client OAuth Login** and **Web OAuth Login**.
4. Add this exact **Valid OAuth Redirect URI**:

   ```text
   https://extra-domain-filters.firebaseapp.com/__/auth/handler
   ```

5. Copy the Meta App ID and App Secret.
6. In **Firebase Authentication > Sign-in method > Facebook**, enable the provider and enter those values.
7. While the Meta app is in development mode, add each Facebook account that will test login under the app's roles/testers and have the person accept the invitation.
8. Before making the app public, complete the current Meta privacy, data-use, business-verification, review, and live-mode requirements that apply. The extension requests only basic identity and email access.

The hosted `https://extra-domain-filters.web.app/auth/` page is not Meta's OAuth redirect. Firebase owns the `/__/auth/handler` callback above and returns the completed credential to the bridge.

If Firebase's `authDomain` is changed to a verified custom domain, register that domain's exact `/__/auth/handler` URL in Meta as part of the same deployment.

## Apple OAuth

Apple web login uses a Services ID associated with a primary App ID. The Sign in with Apple private key is stored in Firebase Console only.

1. In [Apple Developer Certificates, Identifiers & Profiles](https://developer.apple.com/account/resources/identifiers/list), create or select a primary App ID and enable **Sign in with Apple**.
2. Create a **Services ID**, enable Sign in with Apple for it, and associate it with the primary App ID.
3. Configure the Services ID website settings with:

   ```text
   Website domain: extra-domain-filters.firebaseapp.com
   Return URL: https://extra-domain-filters.firebaseapp.com/__/auth/handler
   ```

4. Create a Sign in with Apple key for the primary App ID. Securely record the Apple Team ID, Key ID, Services ID, and downloaded private key. Apple allows the key file to be downloaded only once.
5. In **Firebase Authentication > Sign-in method > Apple**, enable the provider and enter the Services ID, Team ID, Key ID, and private key.
6. Configure Apple's private email relay for the Firebase sender addresses or domains used by verification, password-reset, account, and alert email before sending to people who choose **Hide My Email**.
7. Before production release, implement and document account deletion and Apple token revocation. This is a production requirement separate from basic login.

If Firebase's `authDomain` changes, update both the Apple website domain and return URL in the Services ID configuration.

## Production deployment

Build the public website and the auth bridge together without deploying:

```sh
npm run build:hosting
```

Deploy both to Firebase Hosting (the deploy command rebuilds first; `npm run deploy:auth` is a retained alias for the same command):

```sh
npm run deploy:hosting
```

This publishes the production OAuth bridge at `https://extra-domain-filters.web.app/auth/` alongside the public pages:

- `https://extra-domain-filters.web.app/` — product landing page
- `https://extra-domain-filters.web.app/privacy/` — Privacy Policy
- `https://extra-domain-filters.web.app/terms/` — Terms of Service
- `https://extra-domain-filters.web.app/data-deletion/` — data deletion instructions

Only the Firebase handler (`https://extra-domain-filters.firebaseapp.com/__/auth/handler`) is registered as an OAuth callback with Meta and Apple; the `/auth/` bridge page and the public pages above are never registered as OAuth redirects.

Open `https://extra-domain-filters.web.app/auth/` and confirm it loads. Then create the production extension package:

```sh
npx vite build --mode production
```

Before publishing, inspect `dist/manifest.json`:

- `frame-src` must contain `https://extra-domain-filters.web.app` and no loopback address.
- Host permissions must contain `https://extra-domain-filters.web.app/*` and no loopback address.
- The OAuth client ID must be registered to the published extension ID.

## Troubleshooting

| Symptom | Check |
| --- | --- |
| Provider is supported but not enabled | Enable that provider under Firebase Authentication > Sign-in method. |
| Local bridge is unavailable | Run `npm run dev:auth` and open `http://127.0.0.1:5174/auth/`. |
| Popup closes or is blocked | Start login from the provider button and allow the popup; cancellations are safe to retry. |
| Firebase reports an unauthorized domain | Add the exact unpacked or production `chrome-extension://...` origin to Firebase Authorized domains. |
| Meta or Apple reports a redirect mismatch | Compare `https://extra-domain-filters.firebaseapp.com/__/auth/handler` character-for-character with the provider console. |
| Bridge times out | Confirm the mode-specific bridge is reachable and that the built manifest contains the matching origin. |
| Google fails while Apple/Facebook work | Check the Chrome Extension OAuth client ID and its registered extension ID; Google does not use the bridge. |

Primary references: [Firebase Chrome extension authentication](https://firebase.google.com/docs/auth/web/chrome-extension), [Firebase Facebook login](https://firebase.google.com/docs/auth/web/facebook-login), [Firebase Apple login](https://firebase.google.com/docs/auth/web/apple), [Chrome Identity](https://developer.chrome.com/docs/extensions/reference/api/identity), and [Apple web configuration](https://developer.apple.com/help/account/capabilities/configure-sign-in-with-apple-for-the-web/).
