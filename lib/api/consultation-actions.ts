import { z } from "zod";

import { futureDateTime } from "@/lib/api/consultations";
import { ApiError } from "@/lib/api/errors";
import type { Session } from "@/lib/api/guards";
import { type Consultation, getConsultation } from "@/lib/data/consultations";
import type { RuleResult } from "@/lib/rules/consultations";

// Shared pieces for the action routes under /api/consultations/[id]/.

export const rescheduleSchema = z.strictObject({
  scheduledAt: futureDateTime,
});

export const completeSchema = z.strictObject({
  completed: z.boolean({ message: "Must be true or false" }),
});

// Cancel takes no fields: an empty body or {} only.
export async function requireEmptyBody(request: Request): Promise<void> {
  const text = await request.text();
  if (text.trim() === "") return;

  let body: unknown;
  try {
    body = JSON.parse(text);
  } catch {
    throw new ApiError("bad_request", "The request body must be valid JSON.");
  }
  if (!z.strictObject({}).safeParse(body).success) {
    throw new ApiError("bad_request", "This action takes no fields.");
  }
}

// The logged-in user's own consultation, or a 404. An admin can read every
// row through RLS, but can only change their own, so ownership is checked
// here to answer with the same 404 a student gets.
export async function loadOwnConsultation(
  session: Session,
  id: string,
): Promise<Consultation> {
  if (!z.uuid().safeParse(id).success) {
    throw new ApiError("not_found", "Consultation not found.");
  }
  const row = await getConsultation(session.supabase, id);
  if (row.student_id !== session.userId) {
    throw new ApiError("not_found", "Consultation not found.");
  }
  return row;
}

// Turns a failed rule into a 409.
export function assertRule(result: RuleResult): void {
  if (!result.ok) throw new ApiError("conflict", result.message);
}
