import { createClient } from "@supabase/supabase-js";

import type { Database } from "@/lib/database.types";
import type { ConsultationStatus } from "@/lib/data/consultations";
import type { DbClient } from "@/lib/supabase/server";

// Shared pieces for the tests: the seeded users, a client logged in as each,
// and fixtures made with the secret key. Every row the tests make has a reason
// starting with "test:", so cleanUp() can remove them without touching the
// seed or anyone's own data.

export type UserName = "anon" | "mia" | "sam" | "admin";

// From supabase/seed.sql. Every seeded user's password is password123.
export const USERS = {
  mia: {
    id: "a0000000-0000-4000-8000-000000000002",
    email: "student@example.com",
  },
  sam: { id: "a0000000-0000-4000-8000-000000000003", email: "sam@example.com" },
  admin: {
    id: "a0000000-0000-4000-8000-000000000001",
    email: "admin@example.com",
  },
} as const;

export const TEST_REASON = "test: access matrix";

function env(name: string): string {
  const value = process.env[name];
  if (!value) {
    throw new Error(
      `${name} is not set. Run npx supabase start and check .env.local.`,
    );
  }
  return value;
}

function newClient(key: string): DbClient {
  return createClient<Database>(env("NEXT_PUBLIC_SUPABASE_URL"), key, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

// Bypasses RLS. Only for making and removing fixtures, never for assertions
// about access.
export const service = newClient(env("SUPABASE_SECRET_KEY"));

// A client that queries as the given user, the same way the app does.
export async function clientFor(user: UserName): Promise<DbClient> {
  const client = newClient(env("NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY"));
  if (user === "anon") return client;
  const { error } = await client.auth.signInWithPassword({
    email: USERS[user].email,
    password: "password123",
  });
  if (error) throw new Error(`Could not log in as ${user}: ${error.message}`);
  return client;
}

export async function clientsForAll(): Promise<Record<UserName, DbClient>> {
  const [anon, mia, sam, admin] = await Promise.all(
    (["anon", "mia", "sam", "admin"] as const).map(clientFor),
  );
  return { anon, mia, sam, admin };
}

// An ISO time the given number of days from now (negative for the past).
export function daysFromNow(days: number): string {
  return new Date(Date.now() + days * 86_400_000).toISOString();
}

// Books a consultation for a student, then moves it to the given status, the
// way the seed does, so the rules trigger allows it.
export async function makeConsultation(
  owner: "mia" | "sam",
  status: ConsultationStatus = "booked",
): Promise<string> {
  const { data, error } = await service
    .from("consultations")
    .insert({
      student_id: USERS[owner].id,
      first_name: owner === "mia" ? "Mia" : "Sam",
      last_name: "Test",
      reason: TEST_REASON,
      scheduled_at: daysFromNow(5),
    })
    .select("id")
    .single();
  if (error) throw error;
  if (status !== "booked") {
    const { error: updateError } = await service
      .from("consultations")
      .update({ status })
      .eq("id", data.id);
    if (updateError) throw updateError;
  }
  return data.id;
}

// The row as it is in the database, read past RLS.
export async function readRow(id: string) {
  const { data, error } = await service
    .from("consultations")
    .select("*")
    .eq("id", id)
    .single();
  if (error) throw error;
  return data;
}

export async function cleanUp(): Promise<void> {
  const { error } = await service
    .from("consultations")
    .delete()
    .like("reason", "test:%");
  if (error) throw error;
}
