# Domi Data — iOS (Capacitor) build guide

This project is scaffolded with [Capacitor](https://capacitorjs.com) so the
website can be wrapped in a native iOS shell and submitted to the App Store.

The native `ios/` folder is **not** committed. It is generated on your Mac from
`capacitor.config.ts`. Lovable's Linux sandbox cannot run Xcode or CocoaPods,
so all native steps happen locally.

## One-time Mac setup

Install:

- macOS with **Xcode 15+** (from the App Store)
- Xcode Command Line Tools: `xcode-select --install`
- **CocoaPods**: `sudo gem install cocoapods` (or `brew install cocoapods`)
- Node 20+ / Bun
- An **Apple Developer account** ($99/yr) for TestFlight + App Store

## Generate and open the iOS project

From the repo root on your Mac:

```bash
bun install                # or: npm install
npx cap add ios            # creates the ios/ native project (run once)
npx cap sync ios           # copies config + web assets into the ios/ project
npx cap open ios           # opens the workspace in Xcode
```

In Xcode:

1. Select the `App` target → **Signing & Capabilities**.
2. Set **Team** to your Apple Developer team. Xcode will provision the bundle
   ID `com.heatherdomi.domidata` automatically.
3. Pick a Simulator (e.g. iPhone 15) and press **Run** to smoke-test.

## Hosting mode

`capacitor.config.ts` currently uses **remote mode** (`server.url` points at
`https://domidata.heatherdomi.com`). The app loads the live site, so any
Lovable publish updates the app instantly without an App Store resubmission.

To switch to **bundled mode** (works offline, but every content change requires
a new App Store build):

1. Remove the `server` block from `capacitor.config.ts`.
2. `bun run build` to produce `dist/`.
3. `npx cap sync ios`.

Note: TanStack Start SSR expects a server. Bundled mode only makes sense if the
app is also built as a static export. Stay on remote mode unless offline is a
hard requirement.

## App icon

Reuse the existing 1024×1024 lockup on `#8796a1`:

1. Take `public/apple-touch-icon.png` (or the 512 icon) and upscale/redesign
   at 1024×1024 with **no transparency and no rounded corners** (Apple applies
   the mask).
2. In Xcode, open `App/App/Assets.xcassets/AppIcon.appiconset` and drag the
   1024×1024 PNG onto the **App Store** slot. Xcode 14+ auto-generates the
   other sizes.

Or generate all sizes with a tool like [`@capacitor/assets`](https://github.com/ionic-team/capacitor-assets):

```bash
npm i -D @capacitor/assets
# put a 1024x1024 icon.png and 2732x2732 splash.png in ./resources
npx capacitor-assets generate --ios
```

## Splash screen

Optional but recommended. Add a 2732×2732 `splash.png` under `resources/`
matching the site palette (slate `#8796a1` with the white lockup) and run the
`@capacitor/assets` command above.

## App Store submission checklist

- [ ] Bundle ID `com.heatherdomi.domidata` registered in App Store Connect
- [ ] App icon set (1024×1024 + generated sizes)
- [ ] Launch/splash screen configured
- [ ] Privacy policy URL: `https://heatherdomi.com/privacy-policy/`
- [ ] Support URL and marketing URL set
- [ ] Screenshots (6.7", 6.5", 5.5" iPhone; iPad if targeting iPad)
- [ ] App Review: describe that the app is a wrapper around the published
      Domi Data site; provide test credentials if any content is gated
- [ ] Archive in Xcode → **Product → Archive** → **Distribute App → App Store Connect**

## Adding native features later

Not scaffolded yet, ping when you want any of these:

- Push notifications (`@capacitor/push-notifications` + APNs)
- Universal links / deep links (open `domidata.heatherdomi.com/...` in-app)
- Share sheet, camera, biometrics, etc.

## Updating the app

- **Content / UI change**: publish on Lovable. In remote mode the native app
  picks it up on next launch.
- **Native config change** (icon, splash, plugin, `capacitor.config.ts`):
  `npx cap sync ios` and re-archive in Xcode.
