# Acceptance coverage and release status

13 automated unit/integration tests passed with Node 24 on 11 November 2026. Syntax, architecture boundaries, side-effect isolation, offline asset checks and whitespace checks passed. TypeScript checks for typed inner-layer JavaScript, ESLint and Prettier checks are configured and passing. DOM bindings have syntax/lint checks but are not yet type-checked.

| Story | Implemented behavior                                                         | Automated coverage                                                             | Remaining verification                                    |
| ----- | ---------------------------------------------------------------------------- | ------------------------------------------------------------------------------ | --------------------------------------------------------- |
| F01   | Atomic local save, visible errors, responsive shell, manifest, offline cache | integration: failed writes, stale windows, recovery; static asset integrity    | Browser storage, offline launch, app updates; real iPhone |
| F02   | Catalog CRUD/edit/archive, independent machine identity                      | integration: catalog identity and historical snapshots                         | Browser workflow                                          |
| F03   | Plan create/edit/duplicate/archive; order, set targets, rest                 | integration: duplication and immutable snapshots                               | Browser editor inputs                                     |
| F04   | Rotation, manual start, resume, explicit discard                             | integration: rotation, snapshot and recovery                                   | Browser recovery                                          |
| F05   | Cross-plan prefill, fallback, completion/undo, set changes                   | integration: per-set prior results, fallback, reload                           | Browser interaction                                       |
| F06   | Timestamp rest; restart/skip; optional manual/timed warm-up                  | unit timestamp math; integration controlled clock                              | Backgrounding on iPhone                                   |
| F07   | Jump, defer/reorder, skip, add/remove/replace, settings/targets              | integration: recorded-result safeguards, ordering                              | Browser session editing                                   |
| F08   | Partial finish; before/after review; opt-in plan updates; conflict refusal   | unit plan diffs; integration partial finish, conflict, selective changes       | Browser checkbox workflow                                 |
| F09   | Historical names/settings/results, previous source dates                     | integration: catalog edits preserve history                                    | Browser history display                                   |
| F10   | Versioned offline export, preview/confirm restore, boundary validation       | integration: round trip, malformed/reference/version rejection, failed restore | iOS Files download/upload                                 |
| F11   | Source, instructions, managed hosted preview                                 | Source checks and above suites                                                 | Browser suites and real device release checklist below    |

## Browser suite

`tests/browser.system.mjs` includes Chromium and WebKit at iPhone viewport size. It covers machine/plan creation, duplication, logging, reload, selective targets, cross-plan prefill, JSON download/import, malformed import, and offline recovery. Not run here: managed preview daemon/relay was unavailable, and the deployed private site requires interactive ChatGPT sign-in in the test browser. Managed deployment succeeded; its access gate was observed in the cloud browser. No alternate server or browser route was substituted. Full browser automation and actual localStorage adapter integration remain unverified. DOM binding type coverage remains a future improvement.

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
