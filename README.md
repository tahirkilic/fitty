# Form — Personal training notebook

Implementation preview, updated 13 November 2026. English, kilograms, local-only storage. No account database or AI connection. Hosting access may ask for ChatGPT sign-in; training data stays in the browser.

## iPhone

1. Open the deployed URL in Safari while online and sign in if asked.
2. Tap Share → Add to Home Screen. Open the new Form icon online once.
3. Wait for **Offline ready** in the top right. Add machines in Exercises, then build Plans. New plans enter the visit rotation automatically; customize it under Plans.
4. Start a workout, enter values and tap the circle to complete each set. All session changes save immediately. Plan edits save when you tap Save plan.
5. Finish and choose any target/settings/structure updates to keep. Actual results never automatically change targets. Unfinished sets remain unfinished, and exercises with no completed sets become skipped.
6. Export regularly from Backup → Download JSON backup. Save to Files. Restore with the file picker; review the counts before confirming replacement. Export current data first if it matters.
7. Upload an exported JSON file to ChatGPT yourself for analysis.

Use the same website address and Home Screen app. Local data is specific to the browser/device/origin; Safari and an installed app can have different storage on some iOS versions. Back up before moving, uninstalling, or clearing website data. The app does not promise background audio or lock-screen notifications. Timers recover from stored timestamps.

## Clever Fit migration (Iteration 2)

From the installed iPhone Home Screen app, open **Backup → Import from Clever Fit → Choose Clever Fit workout JSON**. Select `workout_sessions_merged.json` in the iPhone **Files** picker. Review the preview, choose the reference workout for each plan (latest is the default), and review each exercise-to-machine mapping. Select `Create a new record` when two machines have similar names but are not the same. Tap **Import exercises, 2 plans and history** to confirm.

The importer adds reusable exercises/devices, the two **editable plans** (`Einheit A`, `Ganzkörper`) reconstructed from their most recent sessions, and every historical workout linked to its plan. It **does not replace existing workouts**, change the plan rotation, or require connectivity. Conflicting existing plan names are not overwritten: an imported one gets `(Clever Fit)` appended. Add imported plans to your visit rotation explicitly from **Plans**.

Source session dates display as `DD.MM.YYYY`; source start/end clock times are unknown and are not fabricated. Unknown weights and repetitions remain blank; cross-trainer and isometric sets retain their duration. Similarly named machine identities are not fuzzy-merged, and a twice-occurring `Butterfly machine` is kept as two separate occurrences. Machine number/settings are not available in Clever Fit export; imported records have blank fields. Imported plan rest times start with an explicitly editable **90-second app default**.

Repeated imports safely skip previously migrated records, and the entire import saves atomically as one local dataset change. Before a first import, **download a backup** from Backup and store it in iPhone Files. Do not import Clever Fit workout JSON using the separate **Restore from a backup** picker; that picker replaces the app's data. The normal JSON backup retains all migrated plans, history, source mappings and optional values.

The personal Clever Fit JSON must **not** be checked into the repository. Run real-fixture regression locally with `CLEVER_FIT_FIXTURE_PATH=/path/to/workout_sessions_merged.json npm test`. For the source used in this iteration, verify **2 plans, 47 sessions, 539 exercise occurrences and 1,557 recorded sets**. The default empty-catalog import creates **28 distinct catalog records** from 27 strings because of one repeated Butterfly identity; reusing existing catalog records reduces the number created.

## Development

Requires Node 22+. Run `npm ci` to install the pinned development tools; production has no dependencies and no build step. `dist/` is the complete static PWA.

- `npm test`: unit and adapter/application integration checks.
- `npm run typecheck`: TypeScript checks for typed data contracts and inner-layer JavaScript.
- `npm run lint` and `npm run format:check`: configured lint rules and Prettier.
- `npm run check`: JavaScript syntax, dependency boundaries, browser independence of inner layers, whitespace, and offline asset integrity.
- Serve `dist/` over HTTPS (or localhost for development). Service workers require a secure context.
- Optional system suite: `npm ci`, then `npx playwright install chromium webkit`. Run `BASE_URL=https://isolated-test-site.example node --test tests/browser.system.mjs`. The browser suite starts fresh browser profiles and must use a test deployment. Set PLAYWRIGHT_MODULE to an installed absolute module path if necessary.
- No bundling or remote fonts/CDNs. Never put training data in this repository.

## Architecture / ADR 001

Layered MVVM with dependency injection at `dist/main.js` (composition and DOM bindings). Domain handles validation, snapshots, prefill selection, plan diffs, and timestamp arithmetic. Application use cases own mutations and transaction boundaries. Infrastructure adapts synchronous localStorage and versioned JSON; presentation exposes view state and draft editing. Browser time and IDs are injected.

A complete dataset is stored in a single localStorage value. Each mutation clones, validates, persists atomically with `setItem`, and only then publishes the new application state. Failed writes retain the previous state. Compare-before-write detects stale tabs; this is a single-user app, and simultaneous cross-tab transactions are not supported. Never use two windows to log concurrently. There is no silent reset for malformed or unsupported stored data: a recovery download is offered.

## Backup schema v1

Envelope: `schemaVersion: 1`, `appVersion`, `units: "kg"`, UTC `exportedAt`, `data`.

Data contains `exercises`, `plans`, ordered plan-ID `rotation`, next rotation index `next`, finished `sessions`, and nullable `active`. Records have stable string IDs. Exercise/machine records store name, number, free-text settings, and archive flag. Plans have a monotonically increasing version, rest seconds, and ordered items with independent per-set `weight` (decimal kg) and integer `reps`.

Sessions store source plan/version, original prescription `base`, historical machine names/settings, targets and actual values separately, done flags, skipped flags, warm-up seconds, start/finish timestamps, and timer timestamps in milliseconds. Previous values come from the latest finished session with a completed, non-skipped matching machine and set position. Validation covers IDs, references, finite non-negative values, collection size, schema and units. Import validates in full before one replacement write; no merge or partial restore. File input is limited to 10 MB.

## Updates

Change the service-worker cache version in `dist/sw.js` and the ready indicator in `dist/main.js` when assets change. Update the full shell file list for new modules. A new service worker precaches the complete shell and activates after old app clients close. Do not change the localStorage key for ordinary app updates. Breaking schema changes require an explicit validated migration; unknown schemas fail closed. Export before a major update.

## Verification status

See `VERIFICATION.md`. This is a preview, not a release certified on iPhone. Unit and integration checks do not substitute for real browser, Home Screen, or device testing.
