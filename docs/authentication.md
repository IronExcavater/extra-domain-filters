# Authentication setup

The extension uses one Firebase Authentication user for email/password, Google, Apple, and Facebook. Google runs through Chrome Identity. Apple and Facebook run through the shared Firebase-hosted page in `firebase/auth`, proxied by an MV3 offscreen document.

## 1. Firebase baseline

1. In Firebase Console, open **Authentication → Sign-in method**.
2. Enable **Email/Password**. Leave email-link login off unless it is intentionally added later.
3. Under **Authentication → Settings → Authorized domains**, add the release extension origin:

   ```text
   chrome-extension://opblibcobnkicpdjkinngfcbjjnjldkg
   ```

4. Keep the Firebase web-app values and Google OAuth client ID in `.env`, using `.env.example` as the template.
5. In **Authentication → Settings → Password policy**, set at least eight characters and use enforcement mode. Enable email-enumeration protection before launch.

Email sign-up automatically sends Firebase's verification email. Customize its sender name, subject, action URL, and template under **Authentication → Templates**.

## 2. Deploy the hosted OAuth helper

Set the release extension ID before building the helper. Add a comma-separated development extension ID as well when testing an unpacked build.

```env
VITE_EXTENSION_ORIGIN=chrome-extension://opblibcobnkicpdjkinngfcbjjnjldkg
VITE_FIREBASE_AUTH_HELPER_URL=https://YOUR_PROJECT_ID.web.app/auth/
VITE_APPLE_AUTH_ENABLED=false
VITE_FACEBOOK_AUTH_ENABLED=false
```

Build and deploy it:

```sh
npm run build:auth-helper
npx firebase-tools use YOUR_PROJECT_ID
npx firebase-tools deploy --only hosting
```

Open `https://YOUR_PROJECT_ID.web.app/auth/` once to confirm the helper was deployed. Then run `npm run build` and reload the unpacked extension so its manifest contains the helper origin in `frame-src` and host permissions.

Turn each provider flag to `true` only after that provider is enabled and tested in Firebase. Add the unpacked extension's exact `chrome-extension://...` origin instead of the release origin while developing.

Never put an Apple private key or Facebook App Secret in `.env`; both belong in their provider configuration in Firebase Console.

## 3. Facebook app

1. In [Meta for Developers](https://developers.facebook.com/apps/), create an app for authenticating users and add the **Facebook Login** product/use case.
2. In the app's basic settings, enter the public app name, contact email, privacy-policy URL, data-deletion instructions URL, and your Firebase auth domain (`YOUR_PROJECT_ID.firebaseapp.com`) as an app domain.
3. In **Facebook Login → Settings**, enable client OAuth login and web OAuth login. Add this exact **Valid OAuth Redirect URI**:

   ```text
   https://YOUR_PROJECT_ID.firebaseapp.com/__/auth/handler
   ```

   If `VITE_FIREBASE_AUTH_DOMAIN` is a verified custom auth domain, use `https://YOUR_AUTH_DOMAIN/__/auth/handler` instead.
4. Copy the Meta **App ID** and **App Secret**. In Firebase Console, enable the **Facebook** provider and paste both values there.
5. While the Meta app is in development mode, add your Facebook account under **App roles** and test with that account. Users who are not app roles/testers cannot log in until the app is live.
6. Before switching the Meta app live, complete its required privacy, data-use, business-verification, and data-deletion fields. The exact review requirements depend on the permissions requested; this implementation requests only the standard email scope.

If Facebook reports a redirect mismatch, copy the redirect URI shown by Firebase and compare it character-for-character with Meta's Valid OAuth Redirect URIs. Do not use the Chrome `chromiumapp.org` redirect here—the hosted Firebase handler is the correct Facebook callback.

## 4. Apple

1. In Apple Developer **Certificates, Identifiers & Profiles**, enable Sign in with Apple on a primary App ID.
2. Create a **Services ID**, enable Sign in with Apple for it, and associate it with that primary App ID.
3. Configure the website domain as `YOUR_PROJECT_ID.firebaseapp.com` and the return URL as:

   ```text
   https://YOUR_PROJECT_ID.firebaseapp.com/__/auth/handler
   ```

4. Create a Sign in with Apple key and record the Team ID, Key ID, Services ID, and downloaded private key.
5. In Firebase Console, enable **Apple** and enter those four values. The private key is stored only in Firebase's provider configuration.
6. If Firebase emails users who choose Apple's private relay, register Firebase's sender address with Apple's private email relay service.

Before production, add an account-deletion flow and Apple token revocation as required for services that let users create accounts with Apple.

## 5. Verification checklist

- Build the helper and extension with the same Firebase project values.
- Confirm Email/Password, Facebook, and Apple are enabled in Firebase.
- Confirm the extension origin is an authorized Firebase domain.
- Confirm the helper URL is deployed and present in the built manifest's `frame-src`.
- Test email create account, verification email, email login, password reset, Google login, Facebook login, Apple login, logout, and cross-device sync.

Reference: [Firebase Chrome extension authentication](https://firebase.google.com/docs/auth/web/chrome-extension), [Firebase Facebook login](https://firebase.google.com/docs/auth/web/facebook-login), [Firebase Apple login](https://firebase.google.com/docs/auth/web/apple), and [Chrome offscreen documents](https://developer.chrome.com/docs/extensions/reference/api/offscreen).
