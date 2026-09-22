import { handleAuthRequest } from "@/modules/identity-access/server";

export async function GET(request: Request) {
  return handleAuthRequest("GET", request);
}

export async function POST(request: Request) {
  return handleAuthRequest("POST", request);
}
