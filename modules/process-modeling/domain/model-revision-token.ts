const tokenPattern = /^bpmn-revision-([0-9a-z]+)$/;

export function encodeModelRevisionToken(revision: number): string {
  if (!Number.isSafeInteger(revision) || revision < 0) {
    throw new Error("Revision must be a non-negative safe integer.");
  }
  return `bpmn-revision-${revision.toString(36)}`;
}

export function decodeModelRevisionToken(token: string): number {
  const match = tokenPattern.exec(token);
  if (!match) throw new Error("Malformed BPMN revision token.");
  const revision = Number.parseInt(match[1], 36);
  if (!Number.isSafeInteger(revision) || revision < 0) {
    throw new Error("Malformed BPMN revision token.");
  }
  return revision;
}

export function formatStrongModelEtag(revision: number): string {
  return `"${encodeModelRevisionToken(revision)}"`;
}

export function parseStrongModelEtag(value: string): number {
  if (!/^"[^"]+"$/.test(value)) throw new Error("Malformed strong ETag.");
  return decodeModelRevisionToken(value.slice(1, -1));
}
