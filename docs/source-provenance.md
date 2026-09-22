# Source provenance and extraction boundary

The application is extracted from BPMN Studio in The Experience Blogs, source commit `cd4f05729053680b1e0e0ba671e75e1e4796c012` (2026-09-11), by the original owner.

The complete supported process-modeling implementation, authentication, owner profile, protected HTTP APIs, shared controls, PostgreSQL adapters, migration history and relevant regression fixtures are retained. The standalone shell opens the diagram library; unsupported blog destinations and public article embedding adapters are removed. No original Git history, database contents, credentials or production deployment settings are included.

The historical Prisma schema includes dormant editorial tables. Archive guards and cleanup invariants reference them, so the initial release retains the original migration history instead of introducing destructive schema changes. These tables do not expose a blog UI or public article API in this application. Use a fresh database for setup; this release does not migrate an existing blog instance.

Profile identifiers beginning with `teb-` are immutable format identifiers, intentionally retained for XML interoperability. The existing acceptance manifest is preserved except for the scheduled-publication gate, which belongs to the excluded CMS. Human author sessions, real assistive technology and actual browser zoom checks remain explicitly unmeasured.

The development-only Vitest dependency is patched to 4.1.11 to address [GHSA-82fw-gwwq-j7x9](https://github.com/advisories/GHSA-82fw-gwwq-j7x9). Application dependencies remain pinned, and the standalone dependency audit is rerun for release.
