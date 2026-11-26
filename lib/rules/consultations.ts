import type { ConsultationStatus } from "@/lib/data/consultations";

// The consultation rules, checked by the API routes before they write.
// The database trigger enforces the same rules as a backstop; keep the
// messages in step with supabase/migrations/*_consultation_rules.sql.
// See docs/adr/0008-cancel-and-reschedule-rules.md.

export type RuleResult = { ok: true } | { ok: false; message: string };

const ok: RuleResult = { ok: true };
const CANCELLED_IS_FINAL: RuleResult = {
  ok: false,
  message: "Cancelled consultations can't be changed.",
};

export function canReschedule(status: ConsultationStatus): RuleResult {
  if (status === "cancelled") return CANCELLED_IS_FINAL;
  if (status !== "booked") {
    return {
      ok: false,
      message: "Only booked consultations can be rescheduled.",
    };
  }
  return ok;
}

export function canCancel(status: ConsultationStatus): RuleResult {
  if (status === "cancelled") return CANCELLED_IS_FINAL;
  if (status !== "booked") {
    return {
      ok: false,
      message: "Only booked consultations can be cancelled.",
    };
  }
  return ok;
}

// Marking complete or incomplete. Asking for the state it is already in is
// allowed and changes nothing.
export function canSetCompleted(status: ConsultationStatus): RuleResult {
  if (status === "cancelled") return CANCELLED_IS_FINAL;
  return ok;
}
