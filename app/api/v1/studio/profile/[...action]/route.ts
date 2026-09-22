import { handleOwnerProfile } from "@/modules/identity-access/server";
export async function POST(request: Request, context: { params: Promise<{ action: string[] }> }) {
  return handleOwnerProfile(request, (await context.params).action.join("/"));
}
