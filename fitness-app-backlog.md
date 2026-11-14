# Fitty — requirements and development backlog

Version: 1.0 · 11 November 2026 · Status: ready for implementation with proposed defaults below.

## Goal and scope

Create a personal iPhone web app for gym training, inspired by the supplied Clever Fit screenshots and workflows. The user creates plans, rotates through them, logs sets, and adapts each visit without unintentionally changing the plan. ChatGPT will implement the app and can analyze exported training data.

Confirmed requirements:

- Web app rather than native iOS; user does not operate a web server.
- Training works offline after initial setup.
- Any number of plans and exercises; support rotation through two or three plans.
- Each set has its own weight and repetitions. Both prefill from the exercise's last appearance in any plan.
- Show exercise/machine name, machine number, and machine settings.
- One configurable rest duration per plan.
- Reorder, defer, skip, replace, add, and remove exercises during a session.
- At session end, choose which changes update the original plan.
- Cross-trainer warm-up with duration; no general cardio system required.
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
- Machine settings are free text initially. Session snapshots preserve the settings used that day.
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
3. Record cross-trainer warm-up duration, or skip warm-up.
4. See ordered exercises, machine number/settings, and prefilled per-set values.
5. Adjust values and complete sets; each completion starts the rest countdown.
6. Jump to another machine or defer an exercise. Skipping for today remains distinct from deleting it from the plan.
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

- Create/edit a record with name, optional machine number, and settings.
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

### F06 — Rest timer and warm-up · P0

Acceptance criteria:

- Completing a set starts the plan's rest countdown unless disabled.
- Skip/restart the countdown; starting another rest replaces the active countdown.
- Reloading or backgrounding does not restart or freeze elapsed time.
- Record cross-trainer duration manually or through a timer; warm-up is optional.

Dependencies: F05.

### F07 — Flexible session editing · P0

Acceptance criteria:

- Jump between exercises and reorder remaining work without losing recorded sets.
- Defer an exercise and return later; explicitly skip it for today's session.
- Add/remove/replace exercises for today; replacement does not relabel already recorded results as another exercise.
- Session changes leave the source plan unchanged until explicitly applied.

Dependencies: F05.

### F08 — Finish and selectively update plan · P0

Acceptance criteria:

- Finish a complete or partial session; identify unfinished work before saving.
- Show a readable before/after review of changes eligible for the plan: exercises, order, set structure, initial values, and settings.
- Apply selected changes or none. Actual reps/weights and temporary skips do not silently become plan prescriptions.
- Preserve completed session results regardless of selected plan updates.
- If the source plan changed during the workout, do not silently overwrite newer changes; offer to keep session only or resolve the changes.

Dependencies: F07.

### F09 — History · P0

Acceptance criteria:

- List sessions by date and show exercise names, machine settings, completed/skipped status, per-set results, and warm-up duration.
- Preserve historical names/settings even after catalog or plan changes.
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
3. Build F06–F08: timer, warm-up, session flexibility, completion, and plan review.
4. Finish F09–F10: history, validated restore, and ChatGPT-readable export.
5. Complete F11 and release.

Each implementation task should reference its story ID, include its acceptance criteria, state dependencies, and report validation results. Keep changes small enough for ChatGPT to implement and verify within one development task.

## Data model boundaries

- Exercise/machine: stable identity, current name/number/settings, archive state.
- Plan: stable ID and version, ordered exercise prescriptions, rest duration.
- Rotation: ordered plan IDs and next position.
- Session: source plan/version, immutable starting snapshot, mutable session contents, start/end timestamps and status.
- Session exercise/set: exercise identity plus historical display snapshot, planned values, actual values, and status.
- Warm-up: type cross-trainer, duration, completion status.
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
- Increment 3: timestamp timers, optional warm-up, session editing, selective target/settings/structure updates, conflict protection implemented.
- Increment 4: history and validated replacement import implemented.
- Automated validation: 13 unit/integration tests passing; syntax/boundary/offline-asset checks, TypeScript inner-layer checks, ESLint and Prettier passing. Browser system suite added for Chromium and WebKit, not run in this workspace because the preview relay is unavailable.
- F11 remains open: real iPhone installation/offline/lifecycle/file flows, full browser verification, release acceptance.
- Defaults used: English, kg, managed private static hosting, localStorage single-value transaction adapter. No cloud training database, sync, or automatic ChatGPT connection.

## Fitty naming update · 14 November 2026

- F01/F10: interface, browser title, Home Screen metadata, package name, backup and recovery filenames use Fitty. Offline shell refreshed; local storage uses `fitty.fitness.v1` with no legacy storage migration or cache handling. Backup schema remains version 1.
- Regression coverage: Chromium/WebKit system workflow asserts app and install names, backup filename, and offline persistence under the Fitty storage key.
