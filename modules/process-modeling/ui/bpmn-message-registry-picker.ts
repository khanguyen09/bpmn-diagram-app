import type { MessageRegistryEntry } from "../domain/message-registry";

export function normalizeMessageRegistryQuery(value: string): string {
  return value
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .replace(/[đĐ]/g, "d")
    .toLocaleLowerCase("vi")
    .replace(/\s+/g, " ")
    .trim();
}

export function filterMessageRegistry(
  registry: readonly MessageRegistryEntry[],
  query: string,
): readonly MessageRegistryEntry[] {
  const normalized = normalizeMessageRegistryQuery(query);
  if (!normalized) return registry;
  return registry.filter((entry) =>
    normalizeMessageRegistryQuery(
      `${entry.name} ${entry.id} ${entry.owners
        .map((owner) => `${owner.ownerId} ${owner.ownerType}`)
        .join(" ")}`,
    ).includes(normalized),
  );
}

export function duplicateMessageNameIds(
  registry: readonly MessageRegistryEntry[],
  candidateName: string,
  excludedId?: string,
): readonly string[] {
  const normalized = normalizeMessageRegistryQuery(candidateName);
  if (!normalized) return [];
  return registry
    .filter(
      (entry) =>
        entry.id !== excludedId &&
        normalizeMessageRegistryQuery(entry.name) === normalized,
    )
    .map((entry) => entry.id);
}

export function orphanMessageEntries(
  registry: readonly MessageRegistryEntry[],
): readonly MessageRegistryEntry[] {
  return registry.filter(
    (entry) => entry.referenceCount === 0 && !entry.hasUnknownReferences,
  );
}

export function messageOwnerImpactLabel(entry: MessageRegistryEntry): string {
  if (entry.hasUnknownReferences) {
    return `${entry.referenceCount} nơi sử dụng · có nơi chưa được hỗ trợ`;
  }
  return `${entry.referenceCount} nơi sử dụng`;
}
