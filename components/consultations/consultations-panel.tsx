"use client";

import { useRouter } from "next/navigation";
import { useCallback, useEffect, useState } from "react";

import {
  BookDialog,
  CancelDialog,
  RescheduleDialog,
} from "@/components/consultations/consultation-dialogs";
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
import { apiFetch, errorMessage, isUnauthorized } from "@/lib/client/api";
import { formatDateTime } from "@/lib/client/datetime";

// The student's consultations: loads from GET /api/consultations and shows
// the loading, error, empty or table state, with the booking, reschedule and
// cancel dialogs. See docs/wireframes/dashboard*.

type Load =
  | { state: "loading" }
  | { state: "error"; message: string }
  | { state: "ready"; consultations: ConsultationJson[] };

type OpenDialog =
  | { kind: "book" }
  | { kind: "reschedule"; consultation: ConsultationJson }
  | { kind: "cancel"; consultation: ConsultationJson }
  | null;

function bySchedule(a: ConsultationJson, b: ConsultationJson): number {
  return a.scheduledAt.localeCompare(b.scheduledAt);
}

export function ConsultationsPanel() {
  const router = useRouter();
  const [load, setLoad] = useState<Load>({ state: "loading" });
  const [busyId, setBusyId] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [dialog, setDialog] = useState<OpenDialog>(null);
  // Kept after closing, so a dialog's text stays put while it animates out.
  const [lastRow, setLastRow] = useState<ConsultationJson | null>(null);

  // A 401 means the session ended, so go back to Log in.
  const goToLogin = useCallback(() => router.push("/auth/login"), [router]);

  const fetchConsultations = useCallback(async () => {
    try {
      const { consultations } = await apiFetch<{
        consultations: ConsultationJson[];
      }>("/api/consultations");
      setLoad({ state: "ready", consultations });
    } catch (error) {
      if (isUnauthorized(error)) return goToLogin();
      setLoad({ state: "error", message: "Couldn't load consultations." });
    }
  }, [goToLogin]);

  useEffect(() => {
    // Load once on mount; setState happens after the request resolves.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void fetchConsultations();
  }, [fetchConsultations]);

  function retry() {
    setLoad({ state: "loading" });
    void fetchConsultations();
  }

  // Adds a new consultation or replaces a changed one, keeping date order.
  function upsert(consultation: ConsultationJson) {
    setLoad((current) => {
      if (current.state !== "ready") return current;
      const others = current.consultations.filter(
        (row) => row.id !== consultation.id,
      );
      return {
        state: "ready",
        consultations: [...others, consultation].sort(bySchedule),
      };
    });
  }

  function saved(consultation: ConsultationJson) {
    upsert(consultation);
    setDialog(null);
  }

  function openFor(kind: "reschedule" | "cancel", row: ConsultationJson) {
    setActionError(null);
    setLastRow(row);
    setDialog({ kind, consultation: row });
  }

  function closeDialog(open: boolean) {
    if (!open) setDialog(null);
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
      upsert(consultation);
    } catch (error) {
      if (isUnauthorized(error)) return goToLogin();
      setActionError(errorMessage(error));
    } finally {
      setBusyId(null);
    }
  }

  const openBook = () => setDialog({ kind: "book" });
  const dialogRow =
    dialog && dialog.kind !== "book" ? dialog.consultation : lastRow;
  const callbacks = {
    onSaved: saved,
    onUnauthorized: goToLogin,
    onConflict: () => void fetchConsultations(),
  };

  return (
    <>
      <div className="flex items-center gap-4">
        <h1 className="flex-1 text-2xl font-semibold">My consultations</h1>
        <Button onClick={openBook}>Book consultation</Button>
      </div>

      {load.state === "loading" && <LoadingRows />}

      {load.state === "error" && (
        <div
          role="alert"
          className="flex items-center gap-3 rounded-lg border p-4 text-sm"
        >
          <span className="flex-1">{load.message}</span>
          <Button variant="outline" size="sm" onClick={retry}>
            Try again
          </Button>
        </div>
      )}

      {load.state === "ready" && load.consultations.length === 0 && (
        <EmptyState onBook={openBook} />
      )}

      {load.state === "ready" && load.consultations.length > 0 && (
        <div className="flex flex-col gap-3">
          {actionError && (
            <p role="alert" className="text-sm text-destructive">
              {actionError}
            </p>
          )}
          <Table label="My consultations">
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
                  <TableCell className="min-w-48 whitespace-normal">
                    {row.reason}
                  </TableCell>
                  <TableCell>
                    <StatusBadge status={row.status} />
                  </TableCell>
                  <TableCell>
                    <RowActions
                      row={row}
                      busy={busyId === row.id}
                      onSetCompleted={setCompleted}
                      onReschedule={() => openFor("reschedule", row)}
                      onCancel={() => openFor("cancel", row)}
                    />
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}

      <BookDialog
        open={dialog?.kind === "book"}
        onOpenChange={closeDialog}
        {...callbacks}
      />
      <RescheduleDialog
        open={dialog?.kind === "reschedule"}
        onOpenChange={closeDialog}
        consultation={dialogRow}
        {...callbacks}
      />
      <CancelDialog
        open={dialog?.kind === "cancel"}
        onOpenChange={closeDialog}
        consultation={dialogRow}
        {...callbacks}
      />
    </>
  );
}

function RowActions({
  row,
  busy,
  onSetCompleted,
  onReschedule,
  onCancel,
}: {
  row: ConsultationJson;
  busy: boolean;
  onSetCompleted: (id: string, completed: boolean) => void;
  onReschedule: () => void;
  onCancel: () => void;
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

  return (
    <div className="flex gap-2">
      <Button variant="outline" size="sm" onClick={onReschedule}>
        Reschedule
      </Button>
      <Button variant="outline" size="sm" onClick={onCancel}>
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

function EmptyState({ onBook }: { onBook: () => void }) {
  return (
    <div className="flex flex-col items-center gap-2 rounded-lg border border-dashed p-10 text-center">
      <h2 className="font-medium">No consultations yet</h2>
      <p className="text-sm text-muted-foreground">
        Book your first consultation and it will show up here.
      </p>
      <Button className="mt-2" onClick={onBook}>
        Book consultation
      </Button>
    </div>
  );
}
