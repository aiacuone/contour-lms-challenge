import { Badge } from "@/components/ui/badge";
import type { ConsultationStatus } from "@/lib/data/consultations";

const LABEL: Record<ConsultationStatus, string> = {
  booked: "Booked",
  completed: "Completed",
  cancelled: "Cancelled",
};

const VARIANT = {
  booked: "default",
  completed: "secondary",
  cancelled: "outline",
} as const satisfies Record<ConsultationStatus, string>;

export function StatusBadge({ status }: { status: ConsultationStatus }) {
  return (
    <Badge
      variant={VARIANT[status]}
      className={status === "cancelled" ? "border-dashed" : undefined}
    >
      {LABEL[status]}
    </Badge>
  );
}
