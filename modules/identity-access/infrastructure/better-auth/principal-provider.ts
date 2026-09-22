import type { SessionPrincipalProvider } from "../../application/session-principal-provider";
import type { StudioActor } from "../../domain/actor-principal";
import { getAuth } from "./auth";

export const betterAuthPrincipalProvider: SessionPrincipalProvider = {
  async getActor(requestHeaders) {
    const session = await getAuth().api.getSession({
      headers: requestHeaders,
    });
    if (!session) return null;

    const role = (session.user as typeof session.user & { role?: string }).role;
    if (role !== "OWNER") return null;

    return {
      userId: session.user.id,
      email: session.user.email,
      name: session.user.name,
      role,
    } satisfies StudioActor;
  },
};
