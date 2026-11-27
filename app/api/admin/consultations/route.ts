import { NextResponse } from "next/server";

import { toAdminConsultationJson } from "@/lib/api/consultations";
import { withErrorHandling } from "@/lib/api/errors";
import { requireAdmin } from "@/lib/api/guards";
import { listAllConsultations } from "@/lib/data/consultations";

// GET /api/admin/consultations: every consultation with the student's email,
// cancelled ones included, newest first. Admins only; read-only.
export const GET = withErrorHandling(async () => {
  const { supabase } = await requireAdmin();
  const rows = await listAllConsultations(supabase);
  return NextResponse.json({
    consultations: rows.map(toAdminConsultationJson),
  });
});
