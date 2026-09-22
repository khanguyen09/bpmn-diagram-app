import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "./generated/prisma/client";
import { getServerEnv } from "@/platform/config/server-env";
import {
  isRequiredMigrationStateReady,
  type MigrationStateRow,
} from "./migration-manifest";

const prismaGlobal = globalThis as typeof globalThis & {
  experiencePrisma?: PrismaClient;
};

export function getPrisma(): PrismaClient {
  if (!prismaGlobal.experiencePrisma) {
    const adapter = new PrismaPg({
      connectionString: getServerEnv().DATABASE_URL,
    });
    prismaGlobal.experiencePrisma = new PrismaClient({ adapter });
  }

  return prismaGlobal.experiencePrisma;
}

export async function getDatabaseReadiness() {
  const prisma = getPrisma();
  await prisma.$queryRaw`SELECT 1`;
  const migrations = await prisma.$queryRaw<MigrationStateRow[]>`
    SELECT
      "migration_name" AS "migrationName",
      "finished_at" AS "finishedAt",
      "rolled_back_at" AS "rolledBackAt"
    FROM "_prisma_migrations"
  `;
  return {
    ready: isRequiredMigrationStateReady(migrations),
  };
}
