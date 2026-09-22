import { redirect } from "next/navigation";
import { LoginExperience } from "@/modules/identity-access";
import {
  getStudioActor,
  resolveStudioReturnTo,
} from "@/modules/identity-access/server";

export default async function StudioLoginPage({
  searchParams,
}: {
  searchParams: Promise<{ returnTo?: string | string[] }>;
}) {
  const returnTo = resolveStudioReturnTo((await searchParams).returnTo);
  const actor = await getStudioActor();
  if (actor) redirect(returnTo);

  return <LoginExperience returnTo={returnTo} />;
}
