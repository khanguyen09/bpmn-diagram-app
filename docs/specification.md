# Standalone release specification

## Purpose and scope

Provide the existing BPMN Studio as an independently installable application. Preserve the supported editor, model library, folders, database persistence, conflict recovery, immutable milestones, import/export, account and two-factor authentication features. Exclude the original blog CMS, production data, private deployment configuration and original Git history.

“Complete” means feature parity with the supported Studio profiles. It does not mean every element in the OMG standard, an execution engine, realtime multiuser editing or full mobile authoring.

## Requirements and traceability

| Requirement | User journey | Implementation | Verification |
| --- | --- | --- | --- |
| BR-001 Model processes without losing existing capabilities | UC-001 Create/import, edit, validate, save, reload and export | `modules/process-modeling`, diagram pages and process-model APIs | Process-modeling tests; `tests/e2e/bpmn`; independent XML/XSD contracts |
| BR-002 Preserve durable organization and history | UC-002 Move models to folders, save milestones, restore, recover conflicting edits | Model/folder repository adapters, immutable revisions and version APIs | Real PostgreSQL repository tests; folders, conflict and lifecycle browser tests |
| BR-003 Protect private models | UC-003 Sign in, manage profile, password, sessions and 2FA | `modules/identity-access`, Studio layouts and request guards | Owner-profile integration; origin/ownership contracts; browser login |
| BR-004 Make first installation reproducible | UC-004 Generate local configuration, migrate a fresh database, provision owner, run app | `scripts/setup-local.mjs`, package scripts, Compose and README | CLI setup tests; clean dependency install; fresh migrations; build |
| BR-005 Publish reusable source with accurate attribution | UC-005 Clone, inspect, adapt and distribute | MIT LICENSE, third-party notices, pinned provenance and CI | Staged-file privacy audit; retained source licenses; dependency audit |

## Domain and boundaries

An Owner owns folders and process models. Each model has a current draft, durable revisions and immutable version milestones. A profile defines the permitted BPMN semantics. BPMN XML carries the process and diagram layout; visual icons/colors are presentation data. Folder changes do not rewrite model XML. Server persistence enforces ownership, bounded input, revision preconditions and idempotency.

Keep all original migration files and profile IDs immutable. The retained schema has dormant editorial tables needed by historical relations and archive guards; no CMS endpoints are exposed. A fresh database is required for this installation workflow. Importing an existing blog database is not a supported migration procedure.

## Acceptance criteria

- AC-001 A clean install generates credentials without printing them; repeated setup does not overwrite `.env`. Configuration checks reject invalid email, name, origin and password settings.
- AC-002 All migrations apply to an empty database and owner provisioning succeeds once. Additional bootstrap provisioning is refused.
- AC-003 A signed-in owner can create/edit/save/reopen models, organize folders, seal/restore milestones, handle conflicts and export XML/SVG/PNG. Unauthenticated, foreign-owner and wrong-origin requests fail.
- AC-004 Source-level parity covers all 29 supported profiles. Browser and independent-parser checks retain their bounded claims.
- AC-005 Typecheck, lint, unit/integration tests and production build pass. CI also tests pinned PostgreSQL 17, independent conformance across operating systems and the non-root Docker runtime.
- AC-006 Git contains no `.env`, session state, business data, database dumps or private deployment settings. Application MIT terms and upstream fixture/software notices remain distinct.

## Evidence limits

A passing automated accessibility/reflow check is not a completed VoiceOver/NVDA session or actual 200% browser-zoom session. Human-author benchmarks remain unmeasured. Test evidence is recorded separately in [verification.md](verification.md) and CI; historical source-project results are not substituted for this release.
