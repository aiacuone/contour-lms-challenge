// Makes an existing user an admin.
//
//   npm run promote -- someone@example.com
//
// Needs NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SECRET_KEY (read from .env.local
// when present). The secret key bypasses row-level security, so this script is
// the only place outside migrations and the seed file that writes user_roles.

import { createClient } from "@supabase/supabase-js";

function fail(message: string): never {
  console.error(`promote: ${message}`);
  process.exit(1);
}

const email = process.argv[2]?.trim().toLowerCase();
if (!email) fail("usage: npm run promote -- <email>");

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const secretKey = process.env.SUPABASE_SECRET_KEY;
if (!url || !secretKey) {
  fail("set NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SECRET_KEY (see .env.local)");
}

const supabase = createClient(url, secretKey, {
  auth: { autoRefreshToken: false, persistSession: false },
});

async function findUserId(target: string): Promise<string | null> {
  const perPage = 1000;
  for (let page = 1; ; page++) {
    const { data, error } = await supabase.auth.admin.listUsers({
      page,
      perPage,
    });
    if (error) fail(`could not list users: ${error.message}`);
    const match = data.users.find(
      (user) => user.email?.toLowerCase() === target,
    );
    if (match) return match.id;
    if (data.users.length < perPage) return null;
  }
}

const userId = await findUserId(email);
if (!userId) fail(`no user with the email ${email}`);

const { data: existing, error: readError } = await supabase
  .from("user_roles")
  .select("role")
  .eq("user_id", userId)
  .eq("role", "admin")
  .maybeSingle();
if (readError) fail(`could not read roles: ${readError.message}`);
if (existing) {
  console.log(`${email} is already an admin`);
  process.exit(0);
}

const { error: insertError } = await supabase
  .from("user_roles")
  .insert({ user_id: userId, role: "admin" });
if (insertError) fail(`could not grant the admin role: ${insertError.message}`);

console.log(`${email} is now an admin`);
