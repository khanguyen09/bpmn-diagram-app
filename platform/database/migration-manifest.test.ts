import { describe, expect, it } from "vitest";
import {
  isRequiredMigrationStateReady,
  requiredMigrationManifest,
  type MigrationStateRow,
} from "./migration-manifest";

function appliedRows(): MigrationStateRow[] {
  return requiredMigrationManifest.map((migrationName) => ({
    migrationName,
    finishedAt: new Date("2026-09-04T00:00:00.000Z"),
    rolledBackAt: null,
  }));
}

describe("required migration readiness", () => {
  it("is ready only when all eleven manifest entries are finished", () => {
    expect(requiredMigrationManifest).toHaveLength(11);
    expect(isRequiredMigrationStateReady(appliedRows())).toBe(true);
  });

  it.each([
    "20260802000700_editorial_lifecycle_consistency",
    "20260802000800_article_lifecycle_management",
    "20260905000100_owner_profile_two_factor",
    "20260906000200_article_image_assets",
    "20260906130000_process_model_folders",
  ])("is not ready when required migration %s is absent", (missing) => {
    expect(
      isRequiredMigrationStateReady(
        appliedRows().filter((row) => row.migrationName !== missing),
      ),
    ).toBe(false);
  });

  it("is not ready when a required migration is unfinished or rolled back", () => {
    const unfinished = appliedRows().map((row) =>
      row.migrationName === requiredMigrationManifest[7]
        ? { ...row, finishedAt: null }
        : row
    );
    const rolledBack = appliedRows().map((row) =>
      row.migrationName === requiredMigrationManifest[6]
        ? { ...row, rolledBackAt: new Date("2026-09-04T00:01:00.000Z") }
        : row
    );

    expect(isRequiredMigrationStateReady(unfinished)).toBe(false);
    expect(isRequiredMigrationStateReady(rolledBack)).toBe(false);
  });

  it("is not ready while any migration attempt is unfinished and unrolled", () => {
    expect(isRequiredMigrationStateReady([
      ...appliedRows(),
      {
        migrationName: "future_migration_in_progress",
        finishedAt: null,
        rolledBackAt: null,
      },
    ])).toBe(false);
  });
});
