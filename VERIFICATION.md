# Acceptance coverage and release status

13 automated unit/integration tests passed with Node 24 on 11 November 2026. Syntax, architecture boundaries, side-effect isolation, offline asset checks and whitespace checks passed. TypeScript checks for typed inner-layer JavaScript, ESLint and Prettier checks are configured and passing. DOM bindings have syntax/lint checks but are not yet type-checked.

| Story | Implemented behavior                                                         | Automated coverage                                                             | Remaining verification                                    |
| ----- | ---------------------------------------------------------------------------- | ------------------------------------------------------------------------------ | --------------------------------------------------------- |
| F01   | Atomic local save, visible errors, responsive shell, manifest, offline cache | integration: failed writes, stale windows, recovery; static asset integrity    | Browser storage, offline launch, app updates; real iPhone |
| F02   | Catalog CRUD/edit/archive, independent machine identity                      | integration: catalog identity and historical snapshots                         | Browser workflow                                          |
| F03   | Plan create/edit/duplicate/archive; order, set targets, rest                 | integration: duplication and immutable snapshots                               | Browser editor inputs                                     |
| F04   | Rotation, manual start, resume, explicit discard                             | integration: rotation, snapshot and recovery                                   | Browser recovery                                          |
| F05   | Cross-plan prefill, fallback, completion/undo, set changes                   | integration: per-set prior results, fallback, reload                           | Browser interaction                                       |
| F06   | Timestamp rest; restart/skip                                                 | unit timestamp math; integration controlled clock                              | Backgrounding on iPhone                                   |
| F07   | Jump, defer/reorder, skip, add/remove/replace                                | integration: recorded-result safeguards, ordering                              | Browser session editing                                   |
| F08   | Partial finish; before/after review; opt-in plan updates; conflict refusal   | unit plan diffs; integration partial finish, conflict, selective changes       | Browser checkbox workflow                                 |
| F09   | Historical names/results, previous source dates                              | integration: catalog edits preserve history                                    | Browser history display                                   |
| F10   | Versioned offline export, preview/confirm restore, boundary validation       | integration: round trip, malformed/reference/version rejection, failed restore | iOS Files download/upload                                 |
| F11   | Source, instructions, managed hosted preview                                 | Source checks and above suites                                                 | Browser suites and real device release checklist below    |

## Browser suite

`tests/browser.system.mjs` includes Chromium and WebKit at iPhone viewport size. It covers machine/plan creation, duplication, logging, reload, selective set counts, cross-plan prefill, JSON download/import, malformed import, and offline recovery. Not run here: managed preview daemon/relay was unavailable, and the deployed private site requires interactive ChatGPT sign-in in the test browser. Managed deployment succeeded; its access gate was observed in the cloud browser. No alternate server or browser route was substituted. Full browser automation and actual localStorage adapter integration remain unverified. DOM binding type coverage remains a future improvement.

## Manual iPhone release gate (not run)

- Safari online sign-in, Add to Home Screen, launch and wait for Offline ready.
- Airplane mode cold launch, create/edit plan and machine, complete offline workout.
- Background/lock, reopen, confirm rest elapsed correctly and active workout recovers.
- A/B rotation, manual plan choice, discard, partial completion, cross-plan previous values.
- Reorder/defer/replace without relabelling recorded sets; plan targets separate from actuals.
- Export to Files/share, restore via file picker, malformed backup leaves data unchanged.
- Close/reopen online for an app update and verify local data remains intact.
- Check touch targets, decimal keyboard, scrolling, modal focus and VoiceOver.
- Confirm chosen English interface and the user's target iOS version before declaring a release.

## F07 workout card defaults — 14 November 2026

Dependencies: F05. Exercise cards start collapsed for new/resumed page loads and new sessions; users open cards through their headers. The machine jump selector has been removed. View-model regression coverage verifies independent expansion, navigation, new exercises, new sessions, reload defaults and unchanged training data. Chromium/WebKit workflow coverage verifies collapsed startup/reload, mouse/keyboard expansion, logging and offline recovery.

Validation for this change: all 33 unit/integration tests and all three Chromium system workflows passed against an isolated local server. Version, syntax, architecture, lint, type, formatting and diff checks passed. WebKit launch was blocked by missing host libraries (GTK 4, Graphene, WOFF2, HarfBuzz ICU, Hyphen, Manette and GLES); its updated workflows remain unverified here. Actual iPhone checks were not run.

## Regular timed exercises — 14 November 2026

All 34 unit/integration tests and all three Chromium system workflows passed. Timed cardio retains standard per-set logging, recovery, previous-duration prefilling, history and backup coverage. A backup created with the previous release was restored, reloaded, exported and completed successfully without losing existing records or measurements. Version, syntax, architecture, lint, type and formatting checks passed. WebKit remains blocked by the missing host libraries listed above; real iPhone checks were not run.

## Exercise records and plan review — 14 November 2026

All 35 unit/integration tests and three Chromium system workflows passed. Catalog forms expose name and number; workout cards expose per-set measurements. Preserved metadata is excluded from plan-change comparisons. A previous-release backup restored, reloaded and exported unchanged, with no false plan changes and no changes to completed history. Version, syntax, architecture, lint, type, formatting and diff checks passed. WebKit remains blocked by the host libraries listed above; physical iPhone verification remains open.

## Workout measurements — 14 November 2026

All 35 unit/integration tests and three Chromium system workflows passed. Session cards log actual results; plan defaults remain editable in Plans. System coverage verifies optional set-count updates, previous-session prefilling and protection of a catalog editor draft during an app update. Version, syntax, architecture, lint, type, formatting and diff checks passed. WebKit remains blocked by the host libraries listed above; physical iPhone verification remains open.
