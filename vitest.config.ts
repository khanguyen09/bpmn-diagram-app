import path from "node:path";
import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    exclude: [
      "tests/e2e/**",
      "node_modules/**",
      ".next/**",
      // macOS AppleDouble metadata is materialized on external ExFAT volumes.
      "**/._*",
    ],
  },
  resolve: {
    alias: {
      "@": path.resolve(import.meta.dirname),
    },
  },
});
