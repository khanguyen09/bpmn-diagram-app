import type { StudioActor } from "../domain/actor-principal";

export type IdentityAccessErrorCode =
  | "UNAUTHENTICATED"
  | "FORBIDDEN"
  | "UNTRUSTED_ORIGIN";

export class IdentityAccessError extends Error {
  constructor(readonly code: IdentityAccessErrorCode) {
    super(
      code === "UNAUTHENTICATED"
        ? "Authentication required"
        : code === "UNTRUSTED_ORIGIN"
          ? "Trusted request origin required"
          : "Owner access required",
    );
    this.name = "IdentityAccessError";
  }
}

export function requireTrustedOrigin(
  requestOrigin: string | null,
  trustedOrigins: readonly string[],
): void {
  if (!requestOrigin) throw new IdentityAccessError("UNTRUSTED_ORIGIN");

  let normalized: string;
  try {
    normalized = new URL(requestOrigin).origin;
  } catch {
    throw new IdentityAccessError("UNTRUSTED_ORIGIN");
  }

  if (!trustedOrigins.includes(normalized)) {
    throw new IdentityAccessError("UNTRUSTED_ORIGIN");
  }
}

export function requireOwner(actor: StudioActor | null): StudioActor {
  if (!actor) throw new IdentityAccessError("UNAUTHENTICATED");
  if (actor.role !== "OWNER") throw new IdentityAccessError("FORBIDDEN");
  return actor;
}
