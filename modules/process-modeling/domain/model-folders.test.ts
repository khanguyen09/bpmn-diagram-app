import { describe, expect, it } from "vitest";
import { createFolderSchema, folderNameSchema, moveModelsSchema, normalizedFolderName } from "./model-folders";
import { parseProcessModelPageQuery } from "../application/process-model-library";
const id = "10000000-0000-4000-8000-000000000001";
describe("folder organization contracts", () => {
  it("normalizes names and rejects empty/oversized/control names", () => {
    expect(folderNameSchema.parse("  Ticket   Platform  ")).toBe("Ticket Platform");
    expect(normalizedFolderName("TICKET Platform")).toBe("ticket platform");
    for (const name of [" ", "x".repeat(81), "a\u0000b"]) expect(folderNameSchema.safeParse(name).success).toBe(false);
    expect(createFolderSchema.safeParse({ id, name: "Tickets", ownerId: "someone" }).success).toBe(false);
  });
  it("bounds atomic selection and rejects duplicated model IDs", () => {
    expect(moveModelsSchema.safeParse({ folderId: null, models: [{ id, expectedFolderRevision: 0 }] }).success).toBe(true);
    expect(moveModelsSchema.safeParse({ folderId: null, models: [] }).success).toBe(false);
    expect(moveModelsSchema.safeParse({ folderId: null, models: Array(2).fill({ id, expectedFolderRevision: 0 }) }).success).toBe(false);
    expect(moveModelsSchema.safeParse({ folderId: null, models: [{ id, expectedFolderRevision: -1 }] }).success).toBe(false);
  });
  it("keeps folder filter and page bounds explicit", () => {
    expect(parseProcessModelPageQuery(1, 9, "unfiled")).toEqual({ page: 1, pageSize: 9, folderId: null });
    expect(parseProcessModelPageQuery(2, 9, id).folderId).toBe(id);
    expect(() => parseProcessModelPageQuery(1, 9, "bad")).toThrow();
  });
});
