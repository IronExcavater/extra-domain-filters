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

For Edge and Opera, `pnpm dev:edge` and `pnpm dev:opera` build into `.output/edge-mv3-dev` and `.output/opera-mv3-dev`; load that folder in the browser's extensions page. Run one dev server at a time (they share port 3000).

### Store links

`packages/shared/src/config/links.ts` (`STORE_LINKS`) holds where each browser gets the extension. The README and the website read from there. Edge, Firefox and Opera point at a store search until their listings are live: swap in each listing's URL then.

### Google, Apple and Facebook sign-in

Two routes, chosen by `apps/extension/src/background/authBridge.ts`:

- **Offscreen** (one step, in the popup): Chromium browsers whose extension ID is listed in `packages/shared/src/config/auth.ts`. The hosted sign-in page runs in a hidden offscreen document.
- **Tab** (every other browser): the hosted sign-in page opens in a tab with a "Continue with…" button. Its result is posted to the page itself, and the extension's content script on that page (`entrypoints/auth-bridge.content.ts`) relays it to the background, which closes the tab.

Add the Edge and Opera listing IDs to `auth.ts` to give those browsers the one-step route.

## Checks

`pnpm check:all` runs the type check, oxlint and stylelint. Commits run lint-staged through husky.

## Website and sign-in page

`pnpm deploy:hosting` builds the website and the sign-in page and deploys both to Firebase Hosting. Log in once with `npx firebase-tools login` first. The live site is [extra-domain-filters.web.app](https://extra-domain-filters.web.app/), with support at [/support/](https://extra-domain-filters.web.app/support/).

## Store images

`docs/store` holds everything the store listings ask for, built from real popup captures:

| File                              | Size     | Use                                            |
| --------------------------------- | -------- | ---------------------------------------------- |
| `screenshot-*.png`                | 1280×800 | Store screenshots                              |
| `promo-small-440x280.png`         | 440×280  | Chrome Web Store small promo tile              |
| `promo-marquee-1400x560.png`      | 1400×560 | Chrome Web Store marquee tile, README banner   |
| `raw/*.png`                       | 1520×1200 | The popup captured at 2× (760×600 popup)      |
| `web/*.webp`                      | 1520×1200 | Lighter copies the website uses               |

The store icon is `packages/assets/icons/brand/icon.png` (128×128).

To make new ones:

1. Capture the popup at 2× into `docs/store/raw/`: open the popup page at a 1520×1200 viewport with `html { zoom: 2 }`.
2. With `pnpm dev` running, open `http://localhost:3000/@fs/<repo>/docs/store/compose.html` with `?shot=<name>`, `?tile=small` or `?tile=marquee`, at the image's size, and save a screenshot. Headlines and callouts are in `compose.html`.
3. The stores want 24-bit PNGs without alpha: convert with `python -c "from PIL import Image; im = Image.open('x.png'); im.convert('RGB').save('x.png')"`.
