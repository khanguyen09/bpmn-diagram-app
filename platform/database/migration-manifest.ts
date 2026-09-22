export const requiredMigrationManifest = [
  "20260729000100_production_foundation",
  "20260730000200_enforce_revision_post_ownership",
  "20260730000300_process_model_lifecycle",
  "20260730000400_editorial_draft_creation",
  "20260730000500_bpmn_attachment_publication_snapshot",
  "20260730000600_advanced_cms_operations",
  "20260802000700_editorial_lifecycle_consistency",
  "20260802000800_article_lifecycle_management",
  "20260905000100_owner_profile_two_factor",
  "20260906000200_article_image_assets",
  "20260906130000_process_model_folders",
] as const;

export type MigrationStateRow = {
  readonly migrationName: string;
  readonly finishedAt: Date | string | null;
  readonly rolledBackAt: Date | string | null;
};

/**
 * Readiness is conservative: every required migration must be successfully
 * finished, and no migration attempt may still be unfinished and unrolled.
 */
export function isRequiredMigrationStateReady(
  rows: readonly MigrationStateRow[],
) {
  if (rows.some((row) => row.finishedAt === null && row.rolledBackAt === null)) {
    return false;
  }
  const successfullyApplied = new Set(
    rows
      .filter((row) => row.finishedAt !== null && row.rolledBackAt === null)
      .map((row) => row.migrationName),
  );
  return requiredMigrationManifest.every((name) => successfullyApplied.has(name));
}
