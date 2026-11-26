import { NextResponse } from "next/server";

import {
  assertRule,
  loadOwnConsultation,
  requireEmptyBody,
} from "@/lib/api/consultation-actions";
import { toConsultationJson } from "@/lib/api/consultations";
import { withErrorHandling } from "@/lib/api/errors";
import { requireUser } from "@/lib/api/guards";
import { cancelConsultation } from "@/lib/data/consultations";
import { canCancel } from "@/lib/rules/consultations";

// POST /api/consultations/[id]/cancel with no body.
// Owner only; booked only. The row is kept with status cancelled.
export const POST = withErrorHandling(
  async (
    request: Request,
    context: RouteContext<"/api/consultations/[id]/cancel">,
  ) => {
    const session = await requireUser();
    const { id } = await context.params;
    await requireEmptyBody(request);
    const current = await loadOwnConsultation(session, id);
    assertRule(canCancel(current.status));

    const row = await cancelConsultation(session.supabase, id);
    return NextResponse.json({ consultation: toConsultationJson(row) });
  },
);
