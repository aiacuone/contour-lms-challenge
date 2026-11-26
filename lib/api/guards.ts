import { ApiError } from "@/lib/api/errors";
import { createClient, type DbClient } from "@/lib/supabase/server";

// The API routes' coarse checks. Row access itself is decided by RLS in the
// database; see docs/adr/0003-access-control.md.

export type Session = {
  supabase: DbClient;
  userId: string;
};

// 401 unless a user is logged in. Returns the request's Supabase client, which
// queries as that user so RLS applies.
export async function requireUser(): Promise<Session> {
  const supabase = await createClient();
  const { data, error } = await supabase.auth.getClaims();
  const userId = data?.claims?.sub;

  if (error || !userId) {
    throw new ApiError("unauthorized", "You need to log in.");
  }

  return { supabase, userId };
}

// 403 unless the logged-in user is an admin. Uses the same is_admin() function
// as the RLS policies.
export async function requireAdmin(): Promise<Session> {
  const session = await requireUser();
  const { data: isAdmin, error } = await session.supabase.rpc("is_admin");

  if (error) {
    throw new ApiError("internal", "Could not check the user's role.", {
      cause: error,
    });
  }
  if (!isAdmin) {
    throw new ApiError("forbidden", "Only admins can see this.");
  }

  return session;
}
