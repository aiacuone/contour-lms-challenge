import { NextResponse } from "next/server";

import {
  bookConsultationSchema,
  toConsultationJson,
} from "@/lib/api/consultations";
import { withErrorHandling } from "@/lib/api/errors";
import { requireUser } from "@/lib/api/guards";
import { parseBody } from "@/lib/api/validation";
import {
  createConsultation,
  listMyConsultations,
} from "@/lib/data/consultations";

// GET /api/consultations: the logged-in student's consultations, soonest first.
export const GET = withErrorHandling(async () => {
  const { supabase, userId } = await requireUser();
  const rows = await listMyConsultations(supabase, userId);
  return NextResponse.json({ consultations: rows.map(toConsultationJson) });
});

// POST /api/consultations: book a consultation for the logged-in student.
export const POST = withErrorHandling(async (request: Request) => {
  const { supabase } = await requireUser();
  const input = await parseBody(request, bookConsultationSchema);
  const row = await createConsultation(supabase, input);
  return NextResponse.json(
    { consultation: toConsultationJson(row) },
    { status: 201 },
  );
});
