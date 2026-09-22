export type StudioRole = "OWNER";

export interface StudioActor {
  readonly userId: string;
  readonly email: string;
  readonly name: string;
  readonly role: StudioRole;
}
