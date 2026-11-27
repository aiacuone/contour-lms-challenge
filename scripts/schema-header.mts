// Puts a note at the top of supabase/schema.sql after `npm run db:schema`
// regenerates it, so nobody edits the file by hand.

import { readFileSync, writeFileSync } from "node:fs";

const path = "supabase/schema.sql";
const header = `-- The whole public schema in one file, for reading only. Generated from the
-- local database by \`npm run db:schema\`; do not edit it by hand.
-- The migrations in supabase/migrations are the source of truth.
`;

writeFileSync(path, header + readFileSync(path, "utf8").trimStart());
