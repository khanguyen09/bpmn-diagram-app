import { NextResponse } from "next/server";
import { getDatabaseReadiness } from "@/platform/database";
import { getServerEnv } from "@/platform/config/server-env";

export async function GET() {
  try {
    getServerEnv();
    const database = await getDatabaseReadiness();
    if (!database.ready) throw new Error("Migration state is not ready.");
    return NextResponse.json({ status: "ready", database: "reachable" });
  } catch {
    return NextResponse.json(
      { status: "not-ready" },
      { status: 503 },
    );
  }
}
