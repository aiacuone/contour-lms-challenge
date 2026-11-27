// Starts the local Supabase stack (Docker) and writes .env.local from it.
//
//   npm run setup
//
// Starting the stack for the first time applies the migrations and the seed
// file. An existing .env.local is left alone.

import { execFileSync } from "node:child_process";
import { existsSync, writeFileSync } from "node:fs";

const run = (args: string[]) =>
  execFileSync("npx", ["supabase", ...args], {
    encoding: "utf8",
    stdio: ["ignore", "pipe", "inherit"],
  });

console.log("Starting Supabase (the first run downloads images)...");
run(["start"]);

if (existsSync(".env.local")) {
  console.log(".env.local already exists; left as it is.");
  process.exit(0);
}

// `supabase status -o env` prints lines such as API_URL="http://...".
const status = Object.fromEntries(
  run(["status", "-o", "env"])
    .split("\n")
    .map((line) => line.match(/^([A-Z_]+)="?([^"]*)"?$/))
    .filter((match) => match !== null)
    .map((match) => [match[1], match[2]]),
);

for (const key of ["API_URL", "PUBLISHABLE_KEY", "SECRET_KEY"]) {
  if (!status[key]) {
    console.error(`setup: ${key} missing from supabase status`);
    process.exit(1);
  }
}

writeFileSync(
  ".env.local",
  [
    "# Written by npm run setup from the local Supabase stack. Never commit.",
    `NEXT_PUBLIC_SUPABASE_URL=${status.API_URL}`,
    `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=${status.PUBLISHABLE_KEY}`,
    `SUPABASE_SECRET_KEY=${status.SECRET_KEY}`,
    "LOG_LEVEL=info",
    "",
  ].join("\n"),
);
console.log("Wrote .env.local.");
