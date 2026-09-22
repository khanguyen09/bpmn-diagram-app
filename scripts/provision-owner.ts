import "dotenv/config";
import { Client } from "pg";
import { z } from "zod";
import { getPrisma } from "@/platform/database";
import { buildAuth } from "@/modules/identity-access/infrastructure/better-auth/auth";

async function main() {
  const input = z.object({
    OWNER_EMAIL: z.string().email(),
    OWNER_PASSWORD: z.string().min(12).max(128),
    OWNER_NAME: z.string().min(1).max(120),
  }).parse(process.env);

  const lockClient = new Client({ connectionString: process.env.DATABASE_URL });
  const prisma = getPrisma();
  await lockClient.connect();
  await lockClient.query("SELECT pg_advisory_lock($1)", [849231774]);

  try {
    const existing = await prisma.user.count();
    if (existing !== 0) {
      throw new Error("Owner provisioning refused because a user already exists.");
    }

    const result = await buildAuth({ allowBootstrapSignUp: true }).api.signUpEmail({
      body: {
        email: input.OWNER_EMAIL,
        password: input.OWNER_PASSWORD,
        name: input.OWNER_NAME,
      },
    });

    await prisma.user.update({
      where: { id: result.user.id },
      data: { role: "OWNER" },
    });

    process.stdout.write(`Provisioned OWNER ${result.user.id}\n`);
  } finally {
    await lockClient.query("SELECT pg_advisory_unlock($1)", [849231774]);
    await lockClient.end();
    await prisma.$disconnect();
  }
}

main().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : "Owner provisioning failed.");
  process.exitCode = 1;
});
