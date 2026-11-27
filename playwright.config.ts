import { existsSync } from "node:fs";

import { defineConfig, devices } from "@playwright/test";

// Locally the keys come from .env.local; in CI they are set as variables.
if (existsSync(".env.local")) process.loadEnvFile(".env.local");

// The end-to-end test runs against a production build on its own port, so it
// never clashes with a dev server. It needs the local Supabase database
// (npx supabase start). See docs/how-to/testing.md.

const PORT = 3101;

export default defineConfig({
  testDir: "e2e",
  fullyParallel: false,
  workers: 1,
  retries: 0,
  forbidOnly: !!process.env.CI,
  reporter: process.env.CI ? "github" : "list",
  use: {
    baseURL: `http://localhost:${PORT}`,
    timezoneId: "Australia/Melbourne",
    trace: "retain-on-failure",
  },
  projects: [{ name: "chromium", use: { ...devices["Desktop Chrome"] } }],
  webServer: {
    command: `npm run build && npx next start -p ${PORT}`,
    url: `http://localhost:${PORT}`,
    timeout: 180_000,
    reuseExistingServer: false,
  },
});
