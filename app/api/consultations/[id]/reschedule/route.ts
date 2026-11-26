import { NextResponse } from "next/server";

import {
  assertRule,
  loadOwnConsultation,
  rescheduleSchema,
} from "@/lib/api/consultation-actions";
import { toConsultationJson } from "@/lib/api/consultations";
import { withErrorHandling } from "@/lib/api/errors";
import { requireUser } from "@/lib/api/guards";
import { parseBody } from "@/lib/api/validation";
import { rescheduleConsultation } from "@/lib/data/consultations";
import { canReschedule } from "@/lib/rules/consultations";

// POST /api/consultations/[id]/reschedule with { scheduledAt }.
// Owner only; booked only; the new time must be in the future.
export const POST = withErrorHandling(
  async (
    request: Request,
    context: RouteContext<"/api/consultations/[id]/reschedule">,
  ) => {
    const session = await requireUser();
    const { id } = await context.params;
    const { scheduledAt } = await parseBody(request, rescheduleSchema);
    const current = await loadOwnConsultation(session, id);
    assertRule(canReschedule(current.status));

    const row = await rescheduleConsultation(session.supabase, id, scheduledAt);
    return NextResponse.json({ consultation: toConsultationJson(row) });
  },
);
