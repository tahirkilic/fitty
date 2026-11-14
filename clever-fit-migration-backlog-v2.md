# Iteration 2 — Clever Fit data migration

Status: **Implemented; PR #1 and verification PR #2 both merged; physical-iPhone acceptance outstanding**. Updated 14 November 2026.
Source: `workout_sessions_merged.json` (`schema_version: "1.0"`).
Requirements: migrate exercises/devices, create the editable plans **Einheit A** and **Ganzkörper**, and preserve every historical workout and its recorded values. `AGENTS.md` is mandatory.

## Source-data inventory

The personal source file is supplied to the app by the user through the browser's Files picker; it is **not committed** to GitHub.

| Measure                                                                |                  Source |
| ---------------------------------------------------------------------- | ----------------------: |
| Source plan names                                                      |                       2 |
| Historical sessions                                                    |                      47 |
| Source exercise-name strings                                           |                      27 |
| Distinct exercise identity slots (second Butterfly machine occurrence) |                      28 |
| Exercise occurrences (within workouts)                                 |                     539 |
| Sets                                                                   |                   1,557 |
| Null weights                                                           |                      64 |
| Null repetitions                                                       |                      43 |
| Timed cardio occurrences                                               |                      27 |
| Timed isometric occurrences                                            |                       6 |
| First/last dates                                                       | 2026-04-27 / 2026-11-09 |

`Einheit A` uses the latest 2026-06-17 session (9 exercise occurrences) as the default editable plan template; `Ganzkörper` uses the latest 2026-11-09 session (14 exercise occurrences). Other reference workouts can be selected during import. The source does not contain machine numbers, machine settings, plan rest times, or actual clock times; these remain unknown/blank and the plan rest time is an explicit editable default (90s).

## Story status and acceptance criteria

- **CF01 — Parse and validate source JSON (P0): IMPLEMENTED.** Separate strict Clever Fit v1 parser with path-specific errors; nulls, dates and exercise types validated. Does not mutate storage.
- **CF02 — Historical workout model (P0): IMPLEMENTED.** Calendar date separate from unknown start/end clock times; preserve exercise order and individual sets, nulls, timed exercise duration and source metadata.
- **CF03 — Exercise/device catalog mapping (P0): IMPLEMENTED.** Exact unique name/type matches proposed; otherwise create a reusable catalog record, with user-adjustable mapping. Never silently fuzzy-merge spelling variants. Two Butterfly occurrences have distinct source identities.
- **CF04 — Dry-run preview (P0): IMPLEMENTED.** Shows counts, the two proposed plans, reference selectors and per-exercise mapping selectors; no writes before confirmation.
- **CF05 — Atomic additive/idempotent merge (P0): IMPLEMENTED.** Single localStorage dataset transaction with validation, stale-window guard, full rollback on write failure, persisted source fingerprints. No replacement and no automatic rotation changes; repeat import skips existing workouts/plans/catalog identities.
- **CF06 — History and previous-session prefilling (P0): IMPLEMENTED.** Import history shown in standard history view using DD.MM.YYYY; latest eligible non-null completed weight/reps/duration per exercise and set position across plans.
- **CF07 — Two editable plans from latest workout (P0): IMPLEMENTED.** Mandatory creation of both plans, associated with source history and reusable catalog identities; original plan name conflicts get a `(Clever Fit)` suffix instead of overwriting the existing plan. Timed exercises supported in the plan editor.
- **CF08 — Import result/error handling (P1): IMPLEMENTED.** Displays created and skipped counts and actionable errors; import preview can be cancelled. More detailed audit log can be a later enhancement.
- **CF09 — Backup compatibility (P0): IMPLEMENTED.** Existing versioned export/restore preserves added optional historical fields, plan links and provenance; schema version remains 1 for backward compatibility.
- **CF10 — Test coverage (P0): AUTOMATED CHECKS PASS; MANUAL DEVICE VALIDATION PENDING.** Unit/integration tests for validation, identity, transactional rollback, repeated import, backup round-trip; Chromium and WebKit browser scenario for file selection, preview, plan, history, backup and offline use. An additional full-dataset regression is gated by private local `CLEVER_FIT_FIXTURE_PATH`. Real iPhone manual device testing is still required.

## Implementation files

- `dist/domain/clever-fit.js` — source-neutral migration identities and fingerprinting.
- `dist/infrastructure/clever-fit.js` — strict external file format parser/validator.
- `dist/application/clever-fit-migration.js` — preview and atomic, additive migration use case.
- `dist/domain/model.js`, `dist/types.d.ts` — historical date, nullable and timed values, provenance and cross-plan prefills.
- `dist/application/training.js` — start duration-based items.
- `dist/presentation/view-model.js`, `dist/main.js` — Files picker, preview/mapping UI, editable plans and historical displays.
- `dist/sw.js` — offline cache includes new modules.
- `tests/clever-fit.test.js`, `tests/browser.system.mjs` — automated regressions.
- `.github/workflows/verify-clever-fit.yml` — CI checks.

## Acceptance criteria → checks

| Acceptance criteria                                          | Test / check                                                             |
| ------------------------------------------------------------ | ------------------------------------------------------------------------ |
| Parsing, malformed file, invalid calendar date and values    | `tests/clever-fit.test.js`: CF01                                         |
| Separate duplicate devices, exact-match catalog reuse        | `tests/clever-fit.test.js`: CF03                                         |
| All three entity categories, plan links, history, prefilling | `tests/clever-fit.test.js`: CF03–CF07                                    |
| Atomic failure, no replacement, re-import idempotence        | `tests/clever-fit.test.js`: CF04/CF05                                    |
| Versioned backup round-trip                                  | `tests/clever-fit.test.js`: CF09                                         |
| File picker, UI preview, plans/history, offline, WebKit      | `tests/browser.system.mjs`: Clever Fit                                   |
| 47 sessions, 539 occurrences, 1,557 sets, 28 identities      | `CLEVER_FIT_FIXTURE_PATH=/path/to/workout_sessions_merged.json npm test` |

## Iteration 2 verification follow-up (14 November 2026)

The migration implementation was merged into `main` in [PR #1](https://github.com/tahirkilic/fitty/pull/1). The WebKit regression and full-volume verification changes were merged into `main` in [PR #2](https://github.com/tahirkilic/fitty/pull/2) after passing CI.

**Automated checks:** GitHub Actions [successful run #43546688555](https://github.com/tahirkilic/fitty/actions/runs/43546688555) passed formatting, lint, type checks, architecture/syntax checks, unit and integration tests, and the full Chromium + WebKit browser system suite. The synthetic 47-session/539-occurrence/1,557-set dataset is tested through the actual parser and migration use case with detailed value checks, backup round-trip, and re-import idempotence.

**Actual personal source file:** The supplied `workout_sessions_merged.json` passed an independent private structural audit: 47 sessions, 539 exercise occurrences, 1,557 sets, 27 name strings / 28 distinct machine-identity slots, 64 unknown weights and 43 unknown repetitions. No personal workout file was pushed to GitHub. **The actual full file has not been executed through the Fitty importer in the current environment**; a gated exhaustive integration test is available for a local checkout via `CLEVER_FIT_FIXTURE_PATH`.

**WebKit limitation:** Playwright's Linux WebKit emulator reports an internal error on offline navigation and fails offline cached-script fetches. The revised system suite blocks outgoing requests during WebKit file import, then tests existing-page app operations with its browser context offline. Chromium covers a full offline import plus fresh offline startup. **Real iPhone Home Screen offline startup is still unverified.**

See [VERIFICATION-ITERATION-2.md](VERIFICATION-ITERATION-2.md) for the audit, exact verification boundaries, and ten-step physical iPhone checklist. CF01–CF09 implementation and their automated tests are complete; CF10's physical-device acceptance gate and real-file in-app import confirmation remain open. These are **not** reasons to rewrite the migration code without evidence, but they prevent labeling the release fully verified.

## Final release gate

Do not call this released until `npm ci && npm run format:check && npm run lint && npm run typecheck && npm run check && npm test` pass, the Playwright Chromium/WebKit system suite runs in an isolated test host, and any failures are fixed. A manual iPhone Home Screen/offline/Files selection check must be reported separately. Do not commit personal training data to the repository.
