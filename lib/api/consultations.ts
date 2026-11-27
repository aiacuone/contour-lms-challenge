import { z } from "zod";

import type {
  AdminConsultation,
  Consultation,
  ConsultationStatus,
} from "@/lib/data/consultations";

// Request schemas and the JSON shape for consultations. Field limits match the
// database checks; see supabase/migrations.

const name = z
  .string()
  .trim()
  .min(1, "Required")
  .max(80, "80 characters at most");

export const futureDateTime = z.iso
  .datetime({ offset: true, message: "Use a date and time with a time zone" })
  .refine((value) => new Date(value).getTime() > Date.now(), {
    message: "Choose a time in the future",
  });

export const bookConsultationSchema = z.strictObject({
  firstName: name,
  lastName: name,
  reason: z
    .string()
    .trim()
    .min(1, "Required")
    .max(500, "500 characters at most"),
  scheduledAt: futureDateTime,
});

export type ConsultationJson = {
  id: string;
  studentId: string;
  firstName: string;
  lastName: string;
  reason: string;
  scheduledAt: string;
  status: ConsultationStatus;
  createdAt: string;
  updatedAt: string;
};

// The API speaks camelCase; database column names stay internal.
export function toConsultationJson(row: Consultation): ConsultationJson {
  return {
    id: row.id,
    studentId: row.student_id,
    firstName: row.first_name,
    lastName: row.last_name,
    reason: row.reason,
    scheduledAt: row.scheduled_at,
    status: row.status,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export type AdminConsultationJson = ConsultationJson & { studentEmail: string };

export function toAdminConsultationJson(
  row: AdminConsultation,
): AdminConsultationJson {
  return { ...toConsultationJson(row), studentEmail: row.student_email };
}
