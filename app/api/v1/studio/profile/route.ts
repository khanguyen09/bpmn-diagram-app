import { handleOwnerProfile } from "@/modules/identity-access/server";
export const GET = (request: Request) => handleOwnerProfile(request);
export const POST = (request: Request) => handleOwnerProfile(request);
