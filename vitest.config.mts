import { fileURLToPath } from "node:url";

import { defineConfig } from "vitest/config";

// Tests run against the local Supabase database (npx supabase start), one file
// at a time because they share it. See docs/how-to/testing.md.
export default defineConfig({
  resolve: {
    alias: { "@": fileURLToPath(new URL(".", import.meta.url)) },
  },
  test: {
    include: ["tests/**/*.test.ts"],
    setupFiles: ["tests/setup.ts"],
    fileParallelism: false,
    testTimeout: 15_000,
    hookTimeout: 30_000,
  },
});
