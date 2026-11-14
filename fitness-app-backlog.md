# Fitty — requirements and development backlog

Version: 1.0 · 11 November 2026 · Status: ready for implementation with proposed defaults below.

## Goal and scope

Create a personal iPhone web app for gym training, inspired by the supplied Clever Fit screenshots and workflows. The user creates plans, rotates through them, logs sets, and adapts each visit without unintentionally changing the plan. ChatGPT will implement the app and can analyze exported training data.

Confirmed requirements:

- Web app rather than native iOS; user does not operate a web server.
- Training works offline after initial setup.
- Any number of plans and exercises; support rotation through two or three plans.
- Each set has its own weight and repetitions. Both prefill from the exercise's last appearance in any plan.
- Show exercise/machine name and machine number.
- One configurable rest duration per plan.
- Reorder, defer, skip, add, and remove exercises during a session.
- At session end, choose which changes update the original plan.
- Cross-trainer duration is logged as a regular timed exercise in the plan.
- Local data plus file export/import. No direct ChatGPT connection or embedded coaching.
- iCloud and AI write access are outside the first release.

## Proposed defaults

These are implementation defaults, not additional user-confirmed requirements.

- Single user, no account or backend database. Host application files on managed static hosting; choose provider during implementation.
- Kilograms, including decimal weights; integer repetitions; zero weight allowed for bodyweight exercises.
- English interface initially; custom exercise names may be in any language.
- An exercise record identifies a specific exercise/machine. Different machines with the same name have different IDs.
- Previous values come only from completed sets in finished sessions, matched by exercise ID and set position. Skipped or unfinished sets do not replace previous results.
- For a new exercise or extra set with no matching history, use plan defaults. Show the source/date of previous values.
- Starting another workout while one is active offers resume or explicit discard.
- Complete a partial workout with unfinished exercises marked skipped. Discarding a workout does not advance rotation.
- Normal completion advances rotation. Choosing a different plan manually makes the following plan in the rotation next.
- Rotation follows visits rather than calendar weeks.
- Rest timer is a foreground countdown that recalculates from timestamps after reopening. Background sound or lock-screen alerts are not guaranteed requirements.
- Import restores a complete backup by replacement after preview and confirmation. Merge import is deferred.
- Exercise images, muscle diagrams, trainer accounts, and advanced analytics are deferred.

## Main workflow

1. Open Home; resume an active session or see the next suggested plan.
2. Start that plan or choose another. Create an independent session snapshot.
3. Open the exercise you want to log; timed cardio uses regular exercise cards.
4. See ordered exercises, machine number, and prefilled per-set values.
5. Adjust values and complete sets; each completion starts the rest countdown.
6. Tap a collapsed exercise header to open another machine or defer an exercise. Skipping for today remains distinct from deleting it from the plan.
7. Finish; review actual results and a separate list of proposed plan changes.
8. Apply selected plan changes or keep the plan unchanged. Preserve the completed session.
9. Review history or export data for backup and upload to ChatGPT.

## Prioritized backlog

### F01 — Offline application foundation · P0

Acceptance criteria:

- Application fits iPhone portrait screens and can be added to Home Screen.
- After initial online loading/setup, plans, exercises, sessions, history, and export work in airplane mode.
- Updates to application files preserve existing local data.
- A local save failure is visible; the app does not falsely report success.

Dependencies: none.

### F02 — Exercise and machine catalog · P0

Acceptance criteria:

- Create/edit a record with name and optional machine number.
- Select the same record in multiple plans; similarly named machines can remain separate.
- Archive referenced records without breaking plans or history.

Dependencies: F01.

### F03 — Plan editor · P0

Acceptance criteria:

- Create, rename, duplicate, and archive plans.
- Add any number of exercises, reorder them, and configure any positive number of sets.
- Each set has independent initial weight and repetition values.
- Set a rest duration per plan; zero disables automatic countdown.
- Changes to a plan do not alter active or completed session snapshots.

Dependencies: F02.

### F04 — Rotation and start workout · P0

Acceptance criteria:

- Configure an ordered rotation and show the next plan.
- Start the suggested plan or manually select another.
- Starting creates a snapshot with a stable reference to its source plan/version.
- Resume an active session after reopening. Discard requires an explicit action.
- Completed sessions advance rotation according to the documented default; discarded sessions do not.

Dependencies: F03.

### F05 — Previous performance and set logging · P0

Acceptance criteria:

- Prefill both weight and repetitions from the latest eligible completed set for the same exercise/machine across all plans.
- Example: machine X recorded in plan A at 40 kg × 9 prefills the matching set in plan B with 40 kg × 9.
- Skipped sessions/sets do not overwrite the latest eligible values; missing matches use plan defaults.
- Edit per-set values, add/remove sets, complete a set, and undo completion.
- Save every change and preserve it after reload. Targets, actual values, and completion status remain distinguishable.

Dependencies: F04.

### F06 — Rest timer · P0

Acceptance criteria:

- Completing a set starts the plan's rest countdown unless disabled.
- Skip/restart the countdown; starting another rest replaces the active countdown.
- Reloading or backgrounding does not restart or freeze elapsed time.

Dependencies: F05.

### F07 — Flexible session editing · P0

Acceptance criteria:

- Open exercises through their card headers and reorder remaining work without losing recorded sets. All exercise cards start collapsed, including after reload; there is no “Jump to a machine” selector.
- Defer an exercise and return later; explicitly skip it for today's session.
- Add/remove exercises for today; recorded results keep their original exercise identity.
- Session changes leave the source plan unchanged until explicitly applied.

Dependencies: F05.

### F08 — Finish and selectively update plan · P0

Acceptance criteria:

- Finish a complete or partial session; identify unfinished work before saving.
- Show a readable before/after review of changes eligible for the plan: exercises, order, set structure, initial values.
- Apply selected changes or none. Actual reps/weights and temporary skips do not silently become plan prescriptions.
- Preserve completed session results regardless of selected plan updates.
- If the source plan changed during the workout, do not silently overwrite newer changes; offer to keep session only or resolve the changes.

Dependencies: F07.

### F09 — History · P0

Acceptance criteria:

- List sessions by date and show exercise names, completed/skipped status, per-set results, including timed exercises.
- Preserve historical names even after catalog or plan changes.
- Show the previous results from the relevant exercise during training.

Dependencies: F08.

### F10 — Export/import and ChatGPT handoff · P0

Acceptance criteria:

- Export a documented, versioned JSON file containing all exercises, plans, rotation, session history, and any active session.
- Include units, timestamps with timezone offsets or UTC, stable IDs, export time, and schema version. Export works offline.
- File is readable by ChatGPT when the user manually uploads it; export/import does not imply automatic AI access.
- Import previews counts and explains that existing data will be replaced. Offer export of current data before confirmation.
- Validate schema, values, and references before mutation. Reject malformed or unsupported files without changing existing data.
- Restore atomically. An export/import round trip preserves data, including decimal weights and cross-plan exercise identity.

Dependencies: F02–F09. Define the schema early and develop export before expanding features.

### F11 — Release verification and handoff · P0

Acceptance criteria:

- Complete a real-device iPhone test: online install, offline workout, app backgrounding, reload recovery, rest timer, export via iOS sharing/download flow, and import via file selection.
- Verify A/B rotation, previous values across plans, skipped sets, and selective plan updates with meaningful automated tests.
- Verify malformed import rejection and backup round trip.
- Document installation, updating, backup/restore, and how to upload an export to ChatGPT.
- Provide source code, reproducible build instructions, and a managed hosting deployment without requiring a user-run server.

Dependencies: F01–F10.

## Development sequence

1. Define data schema and storage boundaries; build F01, F02, and an early F10 backup path.
2. Build F03–F05: plan creation through a recoverable logged workout.
3. Build F06–F08: timer, session flexibility, completion, and plan review.
4. Finish F09–F10: history, validated restore, and ChatGPT-readable export.
5. Complete F11 and release.

Each implementation task should reference its story ID, include its acceptance criteria, state dependencies, and report validation results. Keep changes small enough for ChatGPT to implement and verify within one development task.

## Data model boundaries

- Exercise/machine: stable identity, current name/number, archive state.
- Plan: stable ID and version, ordered exercise prescriptions, rest duration.
- Rotation: ordered plan IDs and next position.
- Session: source plan/version, immutable starting snapshot, mutable session contents, start/end timestamps and status.
- Session exercise/set: exercise identity plus historical display snapshot, planned values, actual values, and status.
- Export envelope: schema version, export timestamp, application version, units, complete data payload.

## Deferred scope

iCloud backup/sync, automatic ChatGPT retrieval, AI write access, embedded coaching, accounts/multiple users, native iOS app, broader cardio tracking, exercise imagery and anatomy graphics, trainer portal, advanced charts, and automated migration from Clever Fit. Existing plans can be entered manually; historical screenshot import is a separate future task.

## Remaining implementation checks

Confirm interface language, target iOS version, and hosting choice before release. Validate actual iPhone offline and file-sharing behavior rather than relying only on desktop browser tests. No further product decision blocks starting the first development increment using the proposed defaults.

## Implementation progress — 11 November 2026

Status: first functional preview implemented; release verification remains open.

- F01–F10: implementation present in `dist/`, with the coverage mapping and remaining checks in `VERIFICATION.md`. Do not treat these stories as accepted until their browser/device checks pass.
- Increment 1: schema/local repository, machine catalog, plan editor, and early versioned backup path implemented.
- Increment 2: rotation, independent snapshots, cross-plan prefill, persistent set logging implemented.
- Increment 3: timestamp timers, session editing, selective structure updates, conflict protection implemented.
- Increment 4: history and validated replacement import implemented.
- Automated validation: 13 unit/integration tests passing; syntax/boundary/offline-asset checks, TypeScript inner-layer checks, ESLint and Prettier passing. Browser system suite added for Chromium and WebKit, not run in this workspace because the preview relay is unavailable.
- F11 remains open: real iPhone installation/offline/lifecycle/file flows, full browser verification, release acceptance.
- Defaults used: English, kg, managed private static hosting, localStorage single-value transaction adapter. No cloud training database, sync, or automatic ChatGPT connection.

## Fitty naming update · 14 November 2026

- F01/F10: interface, browser title, Home Screen metadata, package name, backup and recovery filenames use Fitty. Offline shell refreshed; local storage uses `fitty.fitness.v1` with no legacy storage migration or cache handling. Backup schema remains version 1.
- Regression coverage: Chromium/WebKit system workflow asserts app and install names, backup filename, and offline persistence under the Fitty storage key.

## History readability · 14 November 2026

- F09 (depends on F08): expanded sessions group results by exercise, with one numbered table row per set, aligned weight/reps or duration columns, explicit completed/unfinished labels, and a separate skipped-exercise label. Historical snapshots and persistence are unchanged.
- Regression mapping: `tests/browser.system.mjs` checks recorded decimal values, unfinished sets, vertical row placement and no horizontal overflow at 320/390px in Chromium/WebKit; the imported-history flow covers duration and missing weight values.
- Validation: 21 unit/integration tests, syntax/architecture checks, TypeScript, ESLint and formatting passed. New browser regressions remain unrun locally because the managed preview relay is unavailable; real iPhone validation remains open.

## Current machine numbers in new workouts · 14 November 2026

- F02/F04/F09: starting a workout resolves each machine number from the catalog by exercise ID, including cleared numbers and existing/imported plans. The session baseline uses the same number, avoiding false plan-update suggestions. Existing plans, active sessions, history, targets and previous-result prefilling retain their behavior.
- Regression mapping: `tests/integration.test.js` covers persistence/reopening, another plan, cleared numbers, immutable active/history snapshots and no unintended plan changes. `tests/browser.system.mjs` covers catalog edits after plan creation, a new workout, an edit during an active workout, history and the following workout in Chromium/WebKit.
- Local validation: regression failed with the old behavior, then all 22 unit/integration tests and syntax/architecture, TypeScript, ESLint and formatting checks passed with the fix. Browser validation runs in GitHub CI; physical iPhone verification remains open.

## Collapsible workout exercises · 14 November 2026

- F07 (depends on F05): each workout exercise uses a native keyboard-accessible disclosure. Headers retain exercise/machine, skipped status and completed/total sets. Cards start collapsed; individual disclosure choices survive rendering, reordering and navigation within the current page/session. New sessions and page reloads start collapsed. Disclosure state stays in the presentation layer and does not modify saved workout data.
- Regression mapping: view-model unit coverage checks independent disclosure, session scoping, navigation and no training-data mutation; Chromium/WebKit system workflow checks touch/click, Enter/Space, progress, rerender/navigation, jump reopening and saved-set recovery after reload.
- Local validation: all 23 unit/integration tests, syntax/architecture, TypeScript, ESLint and formatting checks passed. Browser regression coverage runs in GitHub CI; physical iPhone verification remains open.

## Home Screen app updates · 14 November 2026

- F01 (no dependencies): check for service-worker updates at startup, on foreground/pageshow and reconnect, bypass HTTP cache for the worker and shell installation, and show an accessible Update available / Reload prompt. Activation requires explicit consent; active workout and history data are kept. Other windows prompt without automatic reload. Open editors and save errors block reload. Failed checks/downloads/activation have visible retry messages while the previous app remains usable offline.
- Architecture: `BrowserAppUpdates` implements the update port in `types.d.ts`; `AppUpdateViewModel` exposes presentation state through injection. Async status updates replace only the update region, preserving workout inputs and drafts. No storage schema or training-data mutation is introduced. The worker reads only its own version's cache and handles activation messages after full shell installation.
- Regression mapping: `tests/app-updates.test.js` covers lifecycle checks, offline/reconnect, concurrent checks, existing/new waiting workers, consent, activation failure/timeout, initial install and another window's activation. `tests/browser.system.mjs` serves successive releases on an isolated origin and covers actual worker/cache handover, editor protection, active/history data preservation, consent in another window, failed installation and continued offline access in Chromium/WebKit.
- Existing installations need to receive this release once through an online close/reopen before its update prompt is available. Real iPhone Home Screen foreground/lifecycle acceptance remains open.
- Validation: all 31 unit/integration tests, all 6 Chromium/WebKit system tests (including real upgrade and failed-installation regressions), formatting, ESLint, TypeScript, syntax and architecture checks passed in [GitHub verification](https://github.com/tahirkilic/fitty/actions/runs/43617953489). Physical iPhone Home Screen checks remain open.

## Visible app version and versioned commits · 14 November 2026

- F01/F10: Home displays the running app version; backup appVersion and offline cache share the package version. Each commit, including docs/maintenance commits, must increase the version; patch increments are automatic through installed local commit hooks. API commits must run version:bump explicitly. CI checks every introduced commit against all parents, and rejects inconsistent generated version files. Storage key and backup schema remain unchanged.
- Regression mapping: version script unit/integration coverage checks semantic ordering, synchronization, real commit hooks, manual bumps, staged-file protection and rejected unversioned commits. Chromium/WebKit system workflow verifies the Home label; backup integration verifies appVersion; existing real-upgrade/offline tests use the generated cache identifier.
- Local validation: all 33 unit/integration tests, synchronized-version checks, syntax/architecture, TypeScript, ESLint and formatting passed. Browser version display and existing update/offline flows are covered by the Chromium/WebKit CI suite; real iPhone verification remains open.

## Regular timed exercises · 14 November 2026

- F05/F09/F10 (dependencies: F04): cross-trainer duration uses the regular exercise card and per-set duration workflow. Rest countdowns remain under F06. Session/history summaries only show exercise results.
- Coverage: integration verifies timed cardio logging, recovery, history, export/import and previous-duration prefilling; Chromium/WebKit workflows cover the imported cardio card and saved duration. Existing version-1 backups and saved sessions remain readable without changing the storage key or schema.

## Exercise records and plan review · 14 November 2026

- F02/F07/F08/F09 (dependencies: F05): machine forms contain name and number; workout cards expose per-set measurements and session actions. Plan review compares exercise selection, order and prescribed measurements. Historical records and version-1 backups remain readable.
- Coverage: catalog/workout browser flows verify the remaining inputs; domain regression verifies preserved metadata creates no plan-change suggestions and set-count edits have clear before/after values.

## Workout measurements · 14 November 2026

- F05/F07/F08: workout cards log actual measurements and retain previous-session prefilling. Plan defaults are edited in Plans. The finish review retains optional exercise/order/set-count updates.
- Regression coverage verifies set-count plan updates, unchanged prescribed measurements when logging actual results, cross-plan prefilling and update-time editor protection.

## Session exercise actions · 14 November 2026

- F07 (depends on F05): workout cards expose set addition and removing; hold and drag a card to change its position. New exercises are appended through the session exercise picker. Recorded sets cannot be removed without undoing completion.
- Regression coverage verifies the exact card action list and confirms adding an exercise preserves recorded results and creates a separate session item.

## Confirm exercise and set deletion · 14 November 2026

- F03/F05/F07: removing an exercise or deleting a set requires explicit confirmation naming the exercise and set number where applicable. This applies to active workouts and plan drafts. Cancelling preserves data; confirmed workout changes save immediately, and plan drafts still require Save plan. Existing recorded-result safeguards remain enforced.
- Regression mapping: Chromium/WebKit system workflows cover cancel/confirm for both actions, stored-data preservation, plan drafts, recorded-set safeguards and reload persistence. Existing integration tests verify removal rules and history preservation.

## Workout card action placement · 14 November 2026

- F07: Skip (or Return for skipped exercises) appears in the bottom action row alongside set addition and removing. The existing browser action-row assertion covers the placement; skip/return behavior is unchanged.

## Hold and drag workout ordering · 14 November 2026

- F07 (depends on F05): hold a card for 450 ms, then drag vertically to reorder. Earlier movement cancels the hold and preserves normal scrolling. Active dragging shows a preview and scrolls near viewport edges. Release saves order; Escape, touch cancellation, window blur and page hiding cancel. Inputs/buttons do not start dragging. Alt+Up/Down on a focused header provides keyboard access. No workout move buttons remain.
- Coverage: application integration checks movement in both directions, reload persistence, recorded/skipped set preservation and unchanged plan/history. Chromium/WebKit workflows cover mouse hold gating, touch scrolling versus dragging, cancellation, keyboard focus and persisted order. Physical iPhone gesture validation remains open.

## Exercise completion indicator · 14 November 2026

- F05/F07: the workout exercise number uses the same green background as a completed set when every set is done. Partial completion and undone sets keep the normal number background. The indicator is derived from saved set completion and works on collapsed cards and after reload.
- Regression coverage: Chromium/WebKit workout workflow compares actual computed badge/button colors for partial/all/undone completion, collapsed cards and reload recovery.

## Delete individual history entries · 14 November 2026

- F09 (dependencies: F05/F08): expanded history entries offer Delete workout. A confirmation names the workout/date; cancellation does not mutate data. Confirmed deletion persists atomically, with a visible error on failed storage writes. Other history, plans, catalog, rotation and active session remain unchanged. Future previous-result prefilling ignores deleted sessions, falling back to remaining history or plan defaults. Deleting the final entry shows the empty history state.
- Coverage: application integration covers removal/reload/backup, fallback prefilling, active-session preservation, unknown/active IDs and failed writes. Chromium/WebKit system coverage verifies confirmation/cancel, visible save failure and retry, remaining entries, reload, empty state and retained active workout.

## History action placement · 14 November 2026

- F09: Delete workout is right-aligned beside the recorded-set count, above exercise results. Imported-workout provenance stays on a separate line. Chromium/WebKit history workflows check horizontal placement, vertical alignment, 44px touch height and no horizontal overflow at 320px/390px widths for regular and imported workouts. Deletion confirmation behavior is unchanged.

## Simplified navigation · 14 November 2026

- F01/F02/F10: bottom navigation contains Home, Plans, Workout and History. A top-right More button opens Exercises and Backup & restore in a native popover, with outside-tap/Escape dismissal and keyboard access. Selecting a destination closes the popover; More highlights secondary pages. Training data and persistence are unchanged.
- Coverage: Chromium/WebKit navigation regression checks four main destinations, secondary-page access/selection, dismissal, keyboard focus, mobile touch targets and 320px/390px layout. Existing catalog, backup, recovery and offline system workflows use the More menu.
