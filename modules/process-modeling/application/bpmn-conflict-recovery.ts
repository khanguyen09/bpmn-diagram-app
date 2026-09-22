import type { OpenedProcessModel, ProcessModelPersistenceClient } from "./process-model-persistence-client";

export type BpmnRecoverySnapshot = Pick<OpenedProcessModel, "title" | "description" | "purpose" | "profileId" | "xml"> & { readonly sequence: number };

export function recoverySnapshotFingerprint(snapshot: BpmnRecoverySnapshot): string {
  return JSON.stringify([snapshot.sequence, snapshot.title, snapshot.description, snapshot.purpose, snapshot.profileId, snapshot.xml]);
}

export function recoveryCopyInput(snapshot: BpmnRecoverySnapshot, idempotencyKey: string): Parameters<ProcessModelPersistenceClient["createModel"]>[0] {
  const suffix = " — bản khôi phục";
  let title = "";
  for (const character of snapshot.title.trim()) {
    if (title.length + character.length > 180 - suffix.length) break;
    title += character;
  }
  return { idempotencyKey, title: `${title}${suffix}`, description: snapshot.description, purpose: snapshot.purpose, profileId: snapshot.profileId, xml: snapshot.xml };
}
