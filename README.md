# Budimas Mobile Sales

Vue 3 / Capacitor Android application. API configuration and offline transaction
handling are independent of the visual theme.

## UI release 1.0.9 — 15 October 2026

Beranda, LPH & Klaim, LPH sebelumnya, Histori Outlet, Histori Pembayaran,
Sales Canvas and Profil use a shared blue header and responsive presentation.
The new LPH workflow remains separate from the legacy LPH workflow. Canvas
menu visibility and route permissions are unchanged.

`src/styles/sales-ui.css` contains the shared presentation. Theme ancestor
selectors inside scoped Vue styles must be ordinary selectors such as
`html[data-theme='dark'] .card`. Do not write `:global(html[...]) .card`:
Vue discards the descendant and applies the card's styles to the HTML root.
For a teleported modal, put the **whole** selector inside `:global(...)`.

## Verification

```sh
node --test tests/*.test.mjs
npm run dev -- --host 127.0.0.1 --port 5175 --strictPort
# In another terminal; set PLAYWRIGHT_MODULE and CHROMIUM_PATH if needed:
node tests/browser/ui-consistency.mjs
FRONTEND_TEST_ORIGIN=http://127.0.0.1:5175 node tests/browser/receipt-workflow.mjs
node tests/browser/october5-revision.mjs
```

Browser tests intercept all API requests with synthetic fixtures; they must not
be run against a production frontend. UI audit screenshots default to
`/tmp/budimas-sales-ui`. The receipt workflow test verifies accept, claim and
handover payloads; the order regression covers stock, plafond and payment term.

## Build Android

```sh
npm run build
npx cap sync android
cd android
./gradlew assembleDebug
```

Use the configured Android SDK and a compatible JDK. The UI release does not
require API deployment or database migrations. Existing application data must
be preserved when installing the APK as an update.
