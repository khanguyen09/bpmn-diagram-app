export type ProcessModelPurpose = "AS_IS" | "TO_BE" | "REFERENCE";
export type ProcessModelRevisionSource =
  | "CREATED"
  | "EDITED"
  | "IMPORTED"
  | "RESTORED";
export type ProcessModelCommandOperation =
  | "SAVE_DRAFT"
  | "CREATE_VERSION"
  | "RESTORE_VERSION";

export interface ProcessModelContent {
  readonly title: string;
  readonly description: string;
  readonly purpose: ProcessModelPurpose;
  readonly profileId: string;
  readonly canonicalXml: string;
  readonly xmlChecksum: string;
}

export function assertProcessModelMetadata(input: {
  readonly title: string;
  readonly description: string;
  readonly purpose: ProcessModelPurpose;
}) {
  const title = input.title.trim();
  const description = input.description.trim();
  if (title.length < 1 || title.length > 180) {
    throw new Error("Process model title must contain 1 to 180 characters.");
  }
  if (description.length > 1_000) {
    throw new Error("Process model description must not exceed 1,000 characters.");
  }
  if (!["AS_IS", "TO_BE", "REFERENCE"].includes(input.purpose)) {
    throw new Error("Unsupported process model purpose.");
  }
}
