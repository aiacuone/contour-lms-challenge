"use client";

import Link from "next/link";
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
import type { AdminConsultationJson } from "@/lib/api/consultations";
import { apiFetch, ClientApiError, isUnauthorized } from "@/lib/client/api";
import { formatDateTime } from "@/lib/client/datetime";

// The admin's read-only list of every consultation, newest first, from
// GET /api/admin/consultations. A 403 shows the forbidden view and a 401
// goes to Log in.

type Load =
  | { state: "loading" }
  | { state: "forbidden" }
  | { state: "error" }
  | { state: "ready"; consultations: AdminConsultationJson[] };

export function AdminConsultationsTable() {
  const router = useRouter();
  const [load, setLoad] = useState<Load>({ state: "loading" });

  const fetchConsultations = useCallback(async () => {
    try {
      const { consultations } = await apiFetch<{
        consultations: AdminConsultationJson[];
      }>("/api/admin/consultations");
      setLoad({ state: "ready", consultations });
    } catch (error) {
      if (isUnauthorized(error)) return router.push("/auth/login");
      const forbidden = error instanceof ClientApiError && error.status === 403;
      setLoad({ state: forbidden ? "forbidden" : "error" });
    }
  }, [router]);

  useEffect(() => {
    // Load once on mount; setState happens after the request resolves.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void fetchConsultations();
  }, [fetchConsultations]);

  if (load.state === "forbidden") return <Forbidden />;

  return (
    <>
      <h1 className="text-2xl font-semibold">All consultations</h1>

      {load.state === "loading" && (
        <div
          aria-busy="true"
          aria-label="Loading consultations"
          className="flex flex-col gap-3"
        >
          {[0, 1, 2].map((i) => (
            <Skeleton key={i} className="h-12 w-full" />
          ))}
        </div>
      )}

      {load.state === "error" && (
        <div
          role="alert"
          className="flex items-center gap-3 rounded-lg border p-4 text-sm"
        >
          <span className="flex-1">Couldn&apos;t load consultations.</span>
          <Button
            variant="outline"
            size="sm"
            onClick={() => {
              setLoad({ state: "loading" });
              void fetchConsultations();
            }}
          >
            Try again
          </Button>
        </div>
      )}

      {load.state === "ready" && load.consultations.length === 0 && (
        <p className="rounded-lg border border-dashed p-10 text-center text-sm text-muted-foreground">
          No consultations have been booked yet.
        </p>
      )}

      {load.state === "ready" && load.consultations.length > 0 && (
        <Table label="All consultations">
          <TableHeader>
            <TableRow>
              <TableHead>Student</TableHead>
              <TableHead>Date and time</TableHead>
              <TableHead>Reason</TableHead>
              <TableHead>Status</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {load.consultations.map((row) => (
              <TableRow key={row.id}>
                <TableCell>
                  <div>
                    {row.firstName} {row.lastName}
                  </div>
                  <div className="text-xs text-muted-foreground">
                    {row.studentEmail}
                  </div>
                </TableCell>
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
              </TableRow>
            ))}
          </TableBody>
        </Table>
      )}
    </>
  );
}

function Forbidden() {
  return (
    <div className="flex flex-col items-center gap-3 rounded-lg border p-10 text-center">
      <h1 className="text-xl font-semibold">
        You don&apos;t have access to this page
      </h1>
      <p className="text-sm text-muted-foreground">
        This page is for admins. Your account is a student account.
      </p>
      <Button className="mt-2" render={<Link href="/dashboard" />}>
        Back to my consultations
      </Button>
    </div>
  );
}
