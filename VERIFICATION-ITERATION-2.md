# Iteration 2 — Migration verification and iPhone release checklist

Updated: 14 November 2026. Feature code merged in [PR #1](https://github.com/tahirkilic/fitty/pull/1). Verification follow-up: [PR #2](https://github.com/tahirkilic/fitty/pull/2).

## Scope and verification boundaries

The importer operates in the existing static/offline PWA, using the user-supplied file through iOS Files. A Clever Fit import **adds** exercises/devices, both named editable plans, and completed historical sessions in one localStorage transaction. It does not replace existing data or automatically alter the plan rotation. Backup restore remains a separate, destructive operation with explicit confirmation.

### Private source-file structural audit — PASS

The actual `workout_sessions_merged.json` supplied by the user was inspected in a private local environment, **without committing or uploading the file**.

| Measurement | Actual source |
| --- | ---: |
| Schema | 1.0 |
| Workout sessions | 47 |
| Plan names | 2 (`Einheit A` 20 sessions; `Ganzkörper` 27) |
| Distinct exercise names | 27 |
| Importable exercise/device identity slots | 28 (repeated `Butterfly machine` kept distinct) |
| Exercise occurrences | 539 |
| Recorded sets | 1,557 |
| Sets with unknown/null weight | 64 |
| Sets with unknown/null repetitions | 43 |
| Strength / cardio / isometric occurrences | 506 / 27 / 6 |
| Source date range | 27.04.2026 to 09.11.2026 |

Source fixture SHA-256: `542e8f60ef42456b9dc94b0b620962cac2120051a8f706ca854738a1419389bd`. The latest `Einheit A` reference session is 17.06.2026 (9 exercises, 27 sets); latest `Ganzkörper` is 09.11.2026 (14 exercises, 40 sets). All provided set numbers are consecutive from one, and no set is wholly missing a measurement.

**Important:** This is a structural audit of the actual personal JSON file. It does **not** mean the actual source was imported through Fitty on a device. The in-app importer has automated coverage with a synthetic file of identical overall volume; the optional test below can run the real file when it is available to a local checkout.

### Automated verification

GitHub Actions workflow: `.github/workflows/verify-clever-fit.yml`. Required checks:

- `npm ci`, `npm run format:check`, `npm run lint`, `npm run typecheck`, `npm run check`, `npm test`.
- `BASE_URL=http://127.0.0.1:4173 npm run test:system`, using Chromium and WebKit against an isolated static host.
- System tests include iPhone-sized navigation, catalog, plans, workout recording, backup/restore, Clever Fit file selection, mapping, historical display, repeated imports, and offline use.
- New full-volume **non-personal** fixture generates 47 sessions, 539 exercise occurrences, 1,557 sets and 28 machine identities, and compares every migrated set and session, backup round trip, and second import.
- Playwright WebKit on the Linux runner previously returned an internal browser error on **offline page navigation**. The revised WebKit tests retain real offline mode, check an offline-cached script response and perform offline app operations. Chromium continues to verify a new page loading while offline. This distinction must not be presented as physical iOS offline-start validation.

#### Run the private full-source migration regression

In a trusted local checkout, with the user's source JSON stored outside the Git repository:

```bash
npm ci
CLEVER_FIT_FIXTURE_PATH=/absolute/path/to/workout_sessions_merged.json npm test
```

The fixture-gated test checks source-to-import session names, dates, exact exercise order, type, every set's weight/repetitions/duration, both editable plan templates, plan links, idempotence and backup round-trip. **Do not copy the personal file into GitHub, commit it, or post it in a CI artifact.**

## Real iPhone manual acceptance checklist — NOT YET PERFORMED

A hosted build and physical iPhone are required. Browser WebKit automation is **not** a substitute for these checks:

1. Open the deployed production URL in Safari on iPhone while online and confirm latest app version; add to Home Screen if needed.
2. From the Home Screen app, go to **Backup → Download JSON backup**. Save it in the Files app before migration. Check that it can be opened and copied outside the device.
3. In **Backup → Import from Clever Fit**, pick the supplied `workout_sessions_merged.json` from **Files**. Confirm preview shows 47 workouts, 539 exercise occurrences, 1,557 sets, two plan names and expected mappings.
4. Review name aliases such as `Signature/Slignature Incline Press...` and both `Butterfly machine` occurrences. Select mapping only when the physical equipment is the same; otherwise create separate records. Confirm import once.
5. Verify 2 imported plans exist and can be opened/edited. The new `Einheit A` plan should default to the 17.06.2026 reference session; `Ganzkörper` to 09.11.2026. Add them to rotation manually if desired.
6. Confirm the History view includes 47 **additional** dated workouts, and inspect the oldest (27.04.2026), newest (09.11.2026), a null-weight back extension, a 600-second Crosstrainer, a Low plank, and both Butterfly occurrences.
7. Import the same JSON again. The second import should add **zero** plans, catalog records, workouts and sets.
8. Export a backup. Verify it includes the plans, historical workouts and import mapping metadata. Keep this file in Files.
9. Enable Airplane Mode and close/reopen the Home Screen app. Check that Plans, History, and workout logging work without internet. Verify entries persist after reopening. If offline startup fails, reconnect first; do not clear Safari website data.
10. Start a new workout on one of the imported plans. Verify previous completed weights and repetitions are prefilled from the last eligible recorded session, then cancel/discard without modifying historical workouts.

Mark manual acceptance complete only after the user or tester performs these steps on an actual iPhone and records the results. Do not clear app storage or replace a backup to troubleshoot a migration failure.

## Release decision

Source structural audit is complete. Code and test coverage are committed to GitHub. Passing CI is necessary but not sufficient to claim full migration success. **Full real-file execution in the actual importer and a physical iPhone Home Screen/Files/offline check remain separate acceptance gates**.
