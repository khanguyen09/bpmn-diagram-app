import { redirect } from "next/navigation";
import { getStudioActor } from "@/modules/identity-access/server";
import { SiteShell } from "@/platform/shell";

export default async function StudioLayout({ children }: { children: React.ReactNode }) {
  const actor = await getStudioActor();
  if (!actor) redirect("/studio/login");

  return <SiteShell studio>{children}</SiteShell>;
}
