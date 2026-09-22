export const maxBpmnImportBytes = 1_048_576;

export function bpmnFileIsWithinLimit(size: number) {
  return Number.isSafeInteger(size) && size >= 0 && size <= maxBpmnImportBytes;
}
