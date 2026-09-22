import { betterAuth } from "better-auth";
import { twoFactor } from "better-auth/plugins";
import { createAuthEndpoint } from "better-auth/api";
import { expireCookie } from "better-auth/cookies";
import { prismaAdapter } from "better-auth/adapters/prisma";
import { getPrisma } from "@/platform/database";
import { getServerEnv } from "@/platform/config/server-env";

export function buildAuth(options: { allowBootstrapSignUp?: boolean } = {}) {
  const env = getServerEnv();
  return betterAuth({
    appName: "BPMN Studio",
    baseURL: env.BETTER_AUTH_URL,
    secret: env.BETTER_AUTH_SECRET,
    trustedOrigins: env.BETTER_AUTH_TRUSTED_ORIGINS.split(",")
      .map((origin) => origin.trim())
      .filter(Boolean),
    database: prismaAdapter(getPrisma(), {
      provider: "postgresql",
    }),
    plugins: [twoFactor({
      issuer: "BPMN Studio",
      skipVerificationOnEnable: false,
      backupCodeOptions: { storeBackupCodes: "encrypted" },
    }), {
      id: "owner-challenge-cancellation",
      endpoints: {
        cancelOwnerChallenge: createAuthEndpoint("/two-factor/cancel", { method: "POST" }, async (ctx) => {
          const cookie = ctx.context.createAuthCookie("two_factor");
          const identifier = await ctx.getSignedCookie(cookie.name, ctx.context.secret);
          if (identifier) {
            await ctx.context.internalAdapter.deleteVerificationByIdentifier(identifier);
            await ctx.context.internalAdapter.deleteVerificationByIdentifier(`2fa-attempts-${identifier}`);
          }
          expireCookie(ctx, cookie);
          return ctx.json({ status: true });
        }),
      },
    }],
    rateLimit: { enabled: true, storage: "database", window: 60, max: 100 },
    emailAndPassword: {
      enabled: true,
      disableSignUp: !options.allowBootstrapSignUp,
      autoSignIn: false,
      minPasswordLength: 12,
      maxPasswordLength: 128,
    },
    user: {
      deleteUser: { enabled: false },
      changeEmail: { enabled: false },
      additionalFields: {
        role: {
          type: ["OWNER"],
          required: true,
          defaultValue: "OWNER",
          input: false,
        },
      },
    },
  });
}

let runtimeAuth: ReturnType<typeof buildAuth> | undefined;

export function getAuth() {
  if (!runtimeAuth) runtimeAuth = buildAuth();
  return runtimeAuth;
}
