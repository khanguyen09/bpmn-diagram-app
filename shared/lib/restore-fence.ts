export type RestoreSnapshot = {
  readonly resourceId: string | null;
  readonly sequence: number;
  readonly versionToken: string | null;
};

/** A timed-out mutation is ambiguous, never permission to issue a new command. */
export async function awaitRestoreResponse<T>(response: Promise<T>, timeoutMs = 20_000): Promise<T> {
  let timer: ReturnType<typeof setTimeout> | undefined;
  try {
    return await Promise.race([
      response,
      new Promise<never>((_, reject) => {
        timer = setTimeout(() => reject(new Error("RESTORE_RESPONSE_TIMEOUT")), timeoutMs);
      }),
    ]);
  } finally { clearTimeout(timer); }
}

/** Immediate operation exclusion plus a fence against replacing later local edits. */
export function createRestoreFence() {
  let active: object | null = null;
  return {
    get pending() { return active !== null; },
    begin(snapshot: RestoreSnapshot) {
      if (active) return null;
      const operation = {};
      active = operation;
      return {
        canReplace(current: RestoreSnapshot) {
          return active === operation && snapshot.resourceId === current.resourceId &&
            snapshot.sequence === current.sequence && snapshot.versionToken === current.versionToken;
        },
        finish() { if (active === operation) active = null; },
      };
    },
  };
}
