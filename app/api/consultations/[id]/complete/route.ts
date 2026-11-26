import { NextResponse } from "next/server";

import {
  assertRule,
  completeSchema,
  loadOwnConsultation,
} from "@/lib/api/consultation-actions";
import { toConsultationJson } from "@/lib/api/consultations";
import { withErrorHandling } from "@/lib/api/errors";
import { requireUser } from "@/lib/api/guards";
import { parseBody } from "@/lib/api/validation";
import { setConsultationCompleted } from "@/lib/data/consultations";
import { canSetCompleted } from "@/lib/rules/consultations";

// POST /api/consultations/[id]/complete with { completed: boolean }.
// Owner only; not when cancelled. Incomplete returns it to booked.
export const POST = withErrorHandling(
  async (
    request: Request,
    context: RouteContext<"/api/consultations/[id]/complete">,
  ) => {
    const session = await requireUser();
    const { id } = await context.params;
    const { completed } = await parseBody(request, completeSchema);
    const current = await loadOwnConsultation(session, id);
    assertRule(canSetCompleted(current.status));

    const target = completed ? "completed" : "booked";
    const row =
      current.status === target
        ? current
        : await setConsultationCompleted(session.supabase, id, completed);
    return NextResponse.json({ consultation: toConsultationJson(row) });
  },
);
