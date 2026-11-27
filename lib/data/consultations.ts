import type { PostgrestError } from "@supabase/supabase-js";

import { ApiError } from "@/lib/api/errors";
import type { Database } from "@/lib/database.types";
import type { DbClient } from "@/lib/supabase/server";

// Every database call for consultations. Each function takes the request's
// client, which queries as the logged-in user, so RLS decides which rows are
// visible. See docs/adr/0005-data-access.md.

export type Consultation = Database["public"]["Tables"]["consultations"]["Row"];
export type ConsultationStatus =
  Database["public"]["Enums"]["consultation_status"];
export type AdminConsultation =
  Database["public"]["Functions"]["admin_consultations"]["Returns"][number];

export type NewConsultation = {
  firstName: string;
  lastName: string;
  reason: string;
  scheduledAt: string;
};

const COLUMNS =
  "id, student_id, first_name, last_name, reason, scheduled_at, status, created_at, updated_at";

// Maps a database error onto the shared error shape.
export function toApiError(error: PostgrestError): ApiError {
  switch (error.code) {
    case "P0001": // raised by the consultation rules trigger
      return new ApiError("conflict", error.message, { cause: error });
    case "23514": // check constraint, for example a reason that is too long
    case "22P02": // a value that is not valid for its type
    case "22007": // an invalid date or time
      return new ApiError("bad_request", "Some of the values are not valid.", {
        cause: error,
      });
    case "42501": // missing privilege
      return new ApiError("forbidden", "You can't do that.", { cause: error });
    default:
      return new ApiError("internal", "The database request failed.", {
        cause: error,
      });
  }
}

function notFound(): ApiError {
  return new ApiError("not_found", "Consultation not found.");
}

// The logged-in user's own consultations, soonest first. Filtering by the user
// keeps an admin's own list to their own bookings; RLS is what protects
// other students' rows.
export async function listMyConsultations(
  supabase: DbClient,
  userId: string,
): Promise<Consultation[]> {
  const { data, error } = await supabase
    .from("consultations")
    .select(COLUMNS)
    .eq("student_id", userId)
    .order("scheduled_at", { ascending: true });
  if (error) throw toApiError(error);
  return data;
}

// Every consultation with the student's email, newest first.
export async function listAllConsultations(
  supabase: DbClient,
): Promise<AdminConsultation[]> {
  // admin_consultations() joins in each student's email and returns rows
  // only to admins.
  const { data, error } = await supabase.rpc("admin_consultations");
  if (error) throw toApiError(error);
  return data;
}

// One consultation the user can see, or a 404.
export async function getConsultation(
  supabase: DbClient,
  id: string,
): Promise<Consultation> {
  const { data, error } = await supabase
    .from("consultations")
    .select(COLUMNS)
    .eq("id", id)
    .maybeSingle();
  if (error) throw toApiError(error);
  if (!data) throw notFound();
  return data;
}

// Books a consultation for the logged-in user. The database sets the student
// and the booked status.
export async function createConsultation(
  supabase: DbClient,
  input: NewConsultation,
): Promise<Consultation> {
  const { data, error } = await supabase
    .from("consultations")
    .insert({
      first_name: input.firstName,
      last_name: input.lastName,
      reason: input.reason,
      scheduled_at: input.scheduledAt,
    })
    .select(COLUMNS)
    .single();
  if (error) throw toApiError(error);
  return data;
}

async function update(
  supabase: DbClient,
  id: string,
  changes: { scheduled_at?: string; status?: ConsultationStatus },
): Promise<Consultation> {
  const { data, error } = await supabase
    .from("consultations")
    .update(changes)
    .eq("id", id)
    .select(COLUMNS)
    .maybeSingle();
  if (error) throw toApiError(error);
  // RLS hides other students' rows, so updating one matches nothing.
  if (!data) throw notFound();
  return data;
}

export function rescheduleConsultation(
  supabase: DbClient,
  id: string,
  scheduledAt: string,
): Promise<Consultation> {
  return update(supabase, id, { scheduled_at: scheduledAt });
}

export function cancelConsultation(
  supabase: DbClient,
  id: string,
): Promise<Consultation> {
  return update(supabase, id, { status: "cancelled" });
}

// Marking incomplete returns the consultation to booked.
export function setConsultationCompleted(
  supabase: DbClient,
  id: string,
  completed: boolean,
): Promise<Consultation> {
  return update(supabase, id, { status: completed ? "completed" : "booked" });
}
