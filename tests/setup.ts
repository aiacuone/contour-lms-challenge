import { existsSync } from "node:fs";

// Locally the keys come from .env.local; in CI they are set as variables.
if (existsSync(".env.local")) process.loadEnvFile(".env.local");

// Expected errors (401, 403, 409) are logged as warnings; keep the output to
// real failures.
process.env.LOG_LEVEL ??= "error";
