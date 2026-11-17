# Contributing

Thanks for helping improve Extra Domain Filters. Report bugs and ideas on [GitHub Issues](https://github.com/IronExcavater/extra-domain-filters/issues), or open a pull request.

## Project layout

| Path                 | What it is                                                        |
| -------------------- | ----------------------------------------------------------------- |
| `apps/extension`     | The browser extension, built with [WXT](https://wxt.dev)          |
| `apps/auth`          | The hosted sign-in page for Google, Apple and Facebook (`/auth/`) |
| `apps/site`          | The public website: home, support, privacy, terms, data deletion  |
| `packages/shared`    | Config and message types shared by the apps                       |
| `packages/assets`    | Icons, fonts and images                                           |
| `docs/store`         | Store screenshots and the page that frames them                   |

## Develop

1. Install [pnpm](https://pnpm.io), then run `pnpm install`.
2. Copy `.env.example` to `.env` and fill in the Firebase web-app config (see [authentication setup](docs/authentication.md)).
3. Run `pnpm dev`. It starts the extension, the sign-in page and the website together.
4. In Chrome, open `chrome://extensions`, turn on Developer mode, choose **Load unpacked** and pick `apps/extension/.output/chrome-mv3-dev`.

Keep one `pnpm dev` running. The extension's dev server always uses port 3000, and a second one would rebuild the same folder while Chrome listens to the first. After changing `wxt.config.ts`, reload the extension at `chrome://extensions`.

For Firefox, run `pnpm --filter @extra-domain-filters/extension dev:firefox`.

## Build for each browser

Run these in `apps/extension`. Each build goes to `.output/<browser>-mv3`, and `zip` makes the store upload in `.output`.

| Browser | Build                | Store package                      | Notes                                                                    |
| ------- | -------------------- | ---------------------------------- | ------------------------------------------------------------------------ |
| Chrome  | `pnpm build`         | `pnpm zip`                         |                                                                          |
| Edge    | `pnpm build:edge`    | `pnpm zip -b edge`                 |                                                                          |
| Opera   | `pnpm build:opera`   | `pnpm zip -b opera`                |                                                                          |
| Firefox | `pnpm build:firefox` | `pnpm zip -b firefox`              | Also writes the sources zip that Firefox Add-ons asks for                |
| Safari  | `pnpm build:safari`  | `xcrun safari-web-extension-converter .output/safari-mv3` | Needs a Mac with Xcode; the converter makes the App Store project |

`pnpm zip:all` packages every browser at once.

Google, Apple and Facebook sign-in runs in an offscreen document, which only Chromium browsers have, and the sign-in page only answers extension IDs listed in `packages/shared/src/config/auth.ts`. Add the Edge and Opera IDs there once those listings exist. Firefox and Safari users sign in with email.

## Checks

`pnpm check:all` runs the type check, oxlint and stylelint. Commits run lint-staged through husky.

## Website and sign-in page

`pnpm deploy:hosting` builds the website and the sign-in page and deploys both to Firebase Hosting. Log in once with `npx firebase-tools login` first. The live site is [extra-domain-filters.web.app](https://extra-domain-filters.web.app/), with support at [/support/](https://extra-domain-filters.web.app/support/).

## Store screenshots

The screenshots in `docs/store` are 1280×800. To make new ones:

1. Capture the popup at 760×600 into `docs/store/raw/` (for example from a local build).
2. With `pnpm dev` running, open `http://localhost:3000/@fs/<repo>/docs/store/compose.html?shot=<name>` at 1280×800 and save a screenshot. The headlines are in `compose.html`.
