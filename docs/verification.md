# Release verification

Verification date: 2026-09-22. This record covers the standalone extraction, not historical results from The Experience Blogs.

| Check | Result |
| --- | --- |
| Clean dependency installation from pinned lockfile | Passed, Node 24.18.0 / pnpm 10.12.4 |
| Fresh PostgreSQL migrations and owner bootstrap | Passed, 11 original migrations, isolated local PostgreSQL 14 |
| Unit, contract, CLI and PostgreSQL integration suite | 898 passed; 3 environment-gated cases skipped in this aggregate |
| Dedicated owner profile / authentication integration | 2 passed in its separately guarded database, including 2FA and session revocation |
| Setup CLI | 10 cases included in the aggregate: private generation, no overwrite, invalid config, origin consistency |
| TypeScript / ESLint / production build | Passed |
| Dependency audit | No known vulnerabilities reported after patching Vitest to 4.1.11 |
| Browser regression | 68 Chromium cases passed (6.7 min); separate mobile run 3 passed, including its login setup |
| Independent source review | Core modeling/profile code, all model/folder routes and full migration history retained; only standalone shell/auth destinations and excluded CMS adapter adjusted |
| Public-source privacy review | No credentials, original Git history, live data, local paths, auth state, build outputs or AppleDouble metadata staged |

The CI workflow repeats quality checks on PostgreSQL 17, independent BPMN conformance on Linux/macOS/Windows, browser regression and Docker packaging. Its result is authoritative for the exact GitHub commit. No production deployment is configured.

## Boundaries

Local database evidence uses PostgreSQL 14; the recommended and CI database is PostgreSQL 17. Local browser evidence is Chromium, including mobile emulation; this does not claim Firefox/WebKit UI validation or real device testing. Docker packaging is verified by CI because the local Docker daemon was unavailable.

The aggregate skips the two dedicated auth cases and one datastore-harness integration when their explicit authority is absent. Authentication is run separately as noted above; the datastore harness is run in CI with an empty, explicitly marked database.

The existing evidence manifest deliberately keeps real assistive-technology sessions, actual browser zoom and representative human-author sessions as NOT_RUN. This release is a modeling application with bounded profile support, not workflow execution or universal OMG certification.

## Windows checkout correction

The first GitHub run detected altered fixture checksums on Windows because the extraction omitted the original `.gitattributes` rule. The follow-up restores `tests/fixtures/external/*.bpmn text eol=lf`, preserving original bytes under `core.autocrlf=true`. No provenance checksum or assertion is changed. A fresh checkout simulation and the three-platform CI matrix validate the packaging correction.
