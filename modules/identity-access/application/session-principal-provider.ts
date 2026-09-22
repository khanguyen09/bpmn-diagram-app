import type { StudioActor } from "../domain/actor-principal";

export interface SessionPrincipalProvider {
  getActor(requestHeaders: Headers): Promise<StudioActor | null>;
}
