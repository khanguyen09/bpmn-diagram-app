import { spawn } from "node:child_process";
import { createRequire } from "node:module";
import { buildE2eServerEnvironment } from "../tests/support/e2e-server-environment";

const require = createRequire(import.meta.url);
const nextCli = require.resolve("next/dist/bin/next");
const child = spawn(
  process.execPath,
  [nextCli, "start", "-H", "127.0.0.1", "-p", "3113"],
  {
    cwd: process.cwd(),
    env: buildE2eServerEnvironment(process.env),
    stdio: "inherit",
  },
);

for (const signal of ["SIGINT", "SIGTERM"] as const) {
  process.once(signal, () => {
    if (!child.killed) child.kill(signal);
  });
}

child.once("error", () => {
  process.stderr.write("E2E web server failed to start.\n");
  process.exitCode = 1;
});

child.once("exit", (code, signal) => {
  process.exitCode = code ?? (signal ? 1 : 0);
});
