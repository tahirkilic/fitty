# Fitty development instructions

These rules apply to all Fitty implementation, refactoring, and bug fixes. Treat them as mandatory acceptance criteria alongside the feature backlog. Keep this file at the repository root when development starts.

## Architecture

- Follow a layered architecture with dependencies pointing inward: presentation → application → domain. Infrastructure implements interfaces owned by the inner layers and is wired at the composition root.
- Use Model–View–ViewModel (MVVM), a variant of the MVC family suited to the web interface.
- Domain: entities, value objects, and business rules. Keep it independent of UI frameworks, browser APIs, storage, and external services.
- Application: use cases coordinating domain behavior through explicit interfaces. Own transaction boundaries and application workflows here.
- Presentation: views render state and forward user actions; view models expose presentation state and invoke application use cases. Keep business rules and direct persistence access out of views and view models.
- Infrastructure: implement local persistence, import/export, browser services, and other external adapters. Do not let adapter details leak into the domain or application layers.
- Use dependency injection at the composition root. Avoid global mutable state, service locators, and circular dependencies.
- Document significant architectural decisions and enforce layer boundaries with automated checks.

## Testability

- Everything must be testable. Separate business logic from side effects.
- Inject time, timers, identifiers, storage, and browser services through explicit interfaces where needed. Test rest timers with a controlled clock.
- Prefer small cohesive modules, explicit inputs and outputs, and deterministic domain logic.
- Do not add production-only shortcuts or expose private implementation details merely to make tests pass.

## Required tests

Every implemented feature and bug fix must have automated coverage at the appropriate levels. The project must include unit, integration, and system test suites; a feature is complete only when all applicable levels are covered. Not every individual function needs three separate tests.

- Unit tests: domain rules, application decisions, view-model behavior, validation, boundaries, and failure paths, with external dependencies isolated.
- Integration tests: real interactions between layers and adapters, including local database transactions, schema migrations, persistence recovery, and versioned import/export. Use the real storage implementation in a supported browser where browser behavior matters.
- System tests: user workflows through the running app, including plan creation and rotation, workout logging and recovery, last-session prefilling across plans, timer behavior, session-only edits and selective plan updates, history preservation, offline operation, and backup/restore.
- Add regression tests for bugs before or with the fix.
- Assert observable behavior, not incidental implementation details. Avoid tests that only mirror the implementation, arbitrary sleeps, and mocks that replace the integration being tested.
- Keep tests isolated, repeatable, and independent of live services. Use controlled fixtures and a clock appropriate to the test level.
- Include automated browser coverage suitable for the iPhone interface, including WebKit. Record manual device checks separately; do not claim browser automation proves Home Screen installation or all iOS lifecycle behavior.
- Maintain a mapping from backlog acceptance criteria to tests. Coverage reports support review but do not replace meaningful assertions.

## Clean code

- Strictly follow clean code principles: clear intention-revealing names, single responsibility, cohesive modules, explicit contracts, and minimal coupling.
- Keep functions focused and control flow straightforward. Remove dead code and avoid speculative abstractions, duplicated business rules, magic values, and unnecessary dependencies.
- Prefer composition and the simplest design that meets current requirements. Apply SOLID principles pragmatically.
- Use the language's type system; avoid unchecked types and unsafe casts. Validate data at external boundaries, particularly imported backup files.
- Handle failures explicitly with actionable errors. Never silently discard workout data or partially apply an invalid import.
- Comments explain reasons, invariants, or tradeoffs; they should not repeat the code.
- Configure consistent formatting, linting, static/type checks, and dependency-boundary checks.

## Definition of done

1. Backlog acceptance criteria are implemented and mapped to meaningful automated tests.
2. Unit, integration, and system suites pass for the delivered behavior; run the complete configured suites before declaring a release ready.
3. Formatting, linting, type/static checks, and architecture checks pass.
4. Layer boundaries and MVVM responsibilities are preserved.
5. Failure, recovery, and data-preservation behavior have been verified where relevant.
6. Documentation and architectural decisions reflect the implementation. Report checks actually run and any remaining limitations; never label unrun tests as passing.

## Current product constraints

- Build an offline-capable web app for iPhone use, with local data and file export/import.
- Support rotating plans, per-set weights and repetitions, machine numbers/settings, timed cardio exercises, rest timing, and flexible exercise order/skipping.
- Prefill weights and repetitions from the same exercise/machine's last completed appearance across any plan.
- Keep session changes separate from plan changes; selectively apply approved changes to the plan and preserve historical sessions.
- Defer iCloud and automatic AI data access. Do not introduce a backend or in-app AI coaching without a new requirement.

## App version and commits

- Increment the app version before every commit, including documentation, formatting, maintenance, merge and amend commits. Use stable major.minor.patch versions; patch increments are the default.
- `package.json` is the version source. Run `npm run version:bump` before committing through an API or any path that bypasses Git hooks. It synchronizes the lockfile, Home/backup version module and service-worker cache; include all generated changes in the same commit.
- `npm ci` / `npm install` installs the tracked pre-commit and pre-merge-commit hooks. Ordinary commits automatically bump the patch version unless a larger version has already been staged. Never bypass version checks. Resolve partially staged version-managed files explicitly.
- CI checks every introduced commit against every parent, including commits made through GitHub tools; a final version bump does not repair an earlier unversioned commit. Prefer fast-forward integration of verified commits. A newly created merge commit needs its own higher version.
- Keep Home, exported backup metadata, package/lockfile and offline cache versions synchronized. Preserve the storage key and backup schema during version bumps. Run `npm run version:check` and applicable tests after bumping, before creating each commit.
