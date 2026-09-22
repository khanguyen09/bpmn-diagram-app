const REQUIRED_APPLICATION_ENVIRONMENT = [
  "DATABASE_URL",
  "BETTER_AUTH_SECRET",
  "BETTER_AUTH_URL",
  "BETTER_AUTH_TRUSTED_ORIGINS",
] as const;

const SAFE_OPTIONAL_ENVIRONMENT = ["CI", "LANG", "LC_ALL", "TZ"] as const;

function requiredValue(
  source: Readonly<Record<string, string | undefined>>,
  key: (typeof REQUIRED_APPLICATION_ENVIRONMENT)[number],
): string {
  const value = source[key];
  if (!value) {
    throw new Error(`E2E web server refused to start: ${key} is required.`);
  }
  return value;
}

export function buildE2eServerEnvironment(
  source: Readonly<Record<string, string | undefined>>,
): NodeJS.ProcessEnv {
  const environment: NodeJS.ProcessEnv = {
    NODE_ENV: "production",
    NEXT_TELEMETRY_DISABLED: "1",
    // Prevent Next from reloading OWNER credentials or unrelated values from .env.
    __NEXT_PROCESSED_ENV: "true",
  };

  for (const key of REQUIRED_APPLICATION_ENVIRONMENT) {
    environment[key] = requiredValue(source, key);
  }
  for (const key of SAFE_OPTIONAL_ENVIRONMENT) {
    if (source[key]) environment[key] = source[key];
  }
  return environment;
}
