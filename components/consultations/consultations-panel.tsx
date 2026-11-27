"use client";

import { useRouter } from "next/navigation";
import { useCallback, useEffect, useState } from "react";

import { StatusBadge } from "@/components/consultations/status-badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import type { ConsultationJson } from "@/lib/api/consultations";
import { apiFetch, ClientApiError } from "@/lib/client/api";

// The student's consultations: loads from GET /api/consultations and shows
// the loading, error, empty or table state. See docs/wireframes/dashboard*.

type Load =
  | { state: "loading" }
  | { state: "error"; message: string }
  | { state: "ready"; consultations: ConsultationJson[] };

const dateFormat = new Intl.DateTimeFormat("en-AU", {
  weekday: "short",
  day: "numeric",
  month: "short",
});
const timeFormat = new Intl.DateTimeFormat("en-AU", {
  hour: "numeric",
  minute: "2-digit",
});

// For example "Mon 30 Nov, 3:00 pm", in the browser's time zone.
function formatDateTime(iso: string): string {
  const date = new Date(iso);
  const day = dateFormat.format(date).replace(",", "");
  return `${day}, ${timeFormat.format(date)}`;
}

export function ConsultationsPanel() {
  const router = useRouter();
  const [load, setLoad] = useState<Load>({ state: "loading" });
  const [busyId, setBusyId] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);

  // A 401 means the session ended, so go back to Log in.
  const handleError = useCallback(
    (error: unknown): string | null => {
      if (error instanceof ClientApiError && error.status === 401) {
        router.push("/auth/login");
        return null;
      }
      return error instanceof ClientApiError
        ? error.message
        : "Something went wrong.";
    },
    [router],
  );

  const fetchConsultations = useCallback(async () => {
    try {
      const { consultations } = await apiFetch<{
        consultations: ConsultationJson[];
      }>("/api/consultations");
      setLoad({ state: "ready", consultations });
    } catch (error) {
      if (handleError(error) !== null) {
        setLoad({ state: "error", message: "Couldn't load consultations." });
      }
    }
  }, [handleError]);

  useEffect(() => {
    // Load once on mount; setState happens after the request resolves.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void fetchConsultations();
  }, [fetchConsultations]);

  function retry() {
    setLoad({ state: "loading" });
    void fetchConsultations();
  }

  async function setCompleted(id: string, completed: boolean) {
    setBusyId(id);
    setActionError(null);
    try {
      const { consultation } = await apiFetch<{
        consultation: ConsultationJson;
      }>(`/api/consultations/${id}/complete`, {
        method: "POST",
        body: JSON.stringify({ completed }),
      });
      setLoad((current) =>
        current.state === "ready"
          ? {
              state: "ready",
              consultations: current.consultations.map((row) =>
                row.id === consultation.id ? consultation : row,
              ),
            }
          : current,
      );
    } catch (error) {
      setActionError(handleError(error));
    } finally {
      setBusyId(null);
    }
  }

  if (load.state === "loading") return <LoadingRows />;

  if (load.state === "error") {
    return (
      <div
        role="alert"
        className="flex items-center gap-3 rounded-lg border p-4 text-sm"
      >
        <span className="flex-1">{load.message}</span>
        <Button variant="outline" size="sm" onClick={retry}>
          Try again
        </Button>
      </div>
    );
  }

  if (load.consultations.length === 0) return <EmptyState />;

  return (
    <div className="flex flex-col gap-3">
      {actionError && (
        <p role="alert" className="text-sm text-destructive">
          {actionError}
        </p>
      )}
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Date and time</TableHead>
            <TableHead>Reason</TableHead>
            <TableHead>Status</TableHead>
            <TableHead>Actions</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {load.consultations.map((row) => (
            <TableRow key={row.id}>
              <TableCell>
                <time dateTime={row.scheduledAt}>
                  {formatDateTime(row.scheduledAt)}
                </time>
              </TableCell>
              <TableCell className="whitespace-normal">{row.reason}</TableCell>
              <TableCell>
                <StatusBadge status={row.status} />
              </TableCell>
              <TableCell>
                <RowActions
                  row={row}
                  busy={busyId === row.id}
                  onSetCompleted={setCompleted}
                />
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}

function RowActions({
  row,
  busy,
  onSetCompleted,
}: {
  row: ConsultationJson;
  busy: boolean;
  onSetCompleted: (id: string, completed: boolean) => void;
}) {
  if (row.status === "cancelled") {
    return <span className="sr-only">No actions</span>;
  }

  if (row.status === "completed") {
    return (
      <Button
        variant="outline"
        size="sm"
        disabled={busy}
        onClick={() => onSetCompleted(row.id, false)}
      >
        Mark incomplete
      </Button>
    );
  }

  // Stand-ins: Reschedule and Cancel open dialogs, added in #12.
  return (
    <div className="flex flex-wrap gap-2">
      <Button variant="outline" size="sm" disabled>
        Reschedule
      </Button>
      <Button variant="outline" size="sm" disabled>
        Cancel
      </Button>
      <Button
        variant="outline"
        size="sm"
        disabled={busy}
        onClick={() => onSetCompleted(row.id, true)}
      >
        Mark complete
      </Button>
    </div>
  );
}

function LoadingRows() {
  return (
    <div
      aria-busy="true"
      aria-label="Loading consultations"
      className="flex flex-col gap-3"
    >
      {[0, 1, 2].map((i) => (
        <Skeleton key={i} className="h-10 w-full" />
      ))}
    </div>
  );
}

function EmptyState() {
  return (
    <div className="flex flex-col items-center gap-2 rounded-lg border border-dashed p-10 text-center">
      <h2 className="font-medium">No consultations yet</h2>
      <p className="text-sm text-muted-foreground">
        Book your first consultation and it will show up here.
      </p>
      {/* Stand-in: the booking dialog is added in #12. */}
      <Button className="mt-2" disabled>
        Book consultation
      </Button>
    </div>
  );
}
