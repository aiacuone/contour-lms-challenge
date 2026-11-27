"use client";

import { useState } from "react";
import { z } from "zod";

import { FormField, invalidProps } from "@/components/consultations/form-field";
import {
  AlertDialog,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  bookConsultationSchema,
  type ConsultationJson,
  futureDateTime,
} from "@/lib/api/consultations";
import {
  apiFetch,
  ClientApiError,
  errorMessage,
  type FieldErrors,
  isUnauthorized,
} from "@/lib/client/api";
import {
  formatDateTime,
  fromLocalInput,
  toLocalInput,
} from "@/lib/client/datetime";

// The booking, reschedule and cancel dialogs. Each validates with the same zod
// schema as the API before sending, then shows the server's field errors next
// to the field and any other error (such as a 409) above the buttons.
// See docs/wireframes/book.html, reschedule.html and cancel.html.

type Common = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSaved: (consultation: ConsultationJson) => void;
  onUnauthorized: () => void;
  // A 409 means the list is out of date, so the panel reloads it.
  onConflict: () => void;
};

type Submit = {
  pending: boolean;
  formError: string | null;
  fieldErrors: FieldErrors;
};

type Callbacks = Pick<Common, "onSaved" | "onUnauthorized" | "onConflict">;

const idle: Submit = { pending: false, formError: null, fieldErrors: {} };

// Sends a request and turns a failure into the state the form shows.
async function send(
  request: () => Promise<{ consultation: ConsultationJson }>,
  { onSaved, onUnauthorized, onConflict }: Callbacks,
  setSubmit: (submit: Submit) => void,
) {
  setSubmit({ ...idle, pending: true });
  try {
    const { consultation } = await request();
    setSubmit(idle);
    onSaved(consultation);
  } catch (error) {
    if (isUnauthorized(error)) return onUnauthorized();
    if (error instanceof ClientApiError && error.status === 409) onConflict();
    const fieldErrors =
      error instanceof ClientApiError ? error.fieldErrors : {};
    const hasFieldErrors = Object.keys(fieldErrors).length > 0;
    setSubmit({
      pending: false,
      formError: hasFieldErrors ? null : errorMessage(error),
      fieldErrors,
    });
  }
}

// A datetime-local value as an ISO string, with "Required" when it is empty
// (the schema's own message for an empty value is about time zones).
function readDateTime(value: string): { iso: string; error?: string } {
  const iso = fromLocalInput(value);
  return iso ? { iso } : { iso, error: "Required" };
}

function FormError({ message }: { message: string | null }) {
  if (!message) return null;
  return (
    <p role="alert" className="text-sm text-destructive">
      {message}
    </p>
  );
}

export function BookDialog({ open, onOpenChange, ...rest }: Common) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Book a consultation</DialogTitle>
          <DialogDescription>
            Choose a time and tell us what it&apos;s about.
          </DialogDescription>
        </DialogHeader>
        {/* Inside the popup, so the form starts empty each time it opens. */}
        <BookForm {...rest} />
      </DialogContent>
    </Dialog>
  );
}

function BookForm(callbacks: Callbacks) {
  const [values, setValues] = useState({
    firstName: "",
    lastName: "",
    reason: "",
    scheduledAt: "",
  });
  const [submit, setSubmit] = useState<Submit>(idle);
  const errors = submit.fieldErrors;

  function set(field: keyof typeof values) {
    return (event: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) =>
      setValues((current) => ({ ...current, [field]: event.target.value }));
  }

  function onSubmit(event: React.SubmitEvent<HTMLFormElement>) {
    event.preventDefault();
    const when = readDateTime(values.scheduledAt);
    const body = { ...values, scheduledAt: when.iso };
    const result = bookConsultationSchema.safeParse(body);
    if (!result.success || when.error) {
      const fieldErrors: FieldErrors = result.success
        ? {}
        : z.flattenError(result.error).fieldErrors;
      if (when.error) fieldErrors.scheduledAt = [when.error];
      return setSubmit({ ...idle, fieldErrors });
    }
    void send(
      () =>
        apiFetch("/api/consultations", {
          method: "POST",
          body: JSON.stringify(result.data),
        }),
      callbacks,
      setSubmit,
    );
  }

  return (
    <form noValidate onSubmit={onSubmit} className="flex flex-col gap-4">
      <div className="grid gap-4 sm:grid-cols-2">
        <FormField
          id="firstName"
          label="First name"
          error={errors.firstName?.[0]}
        >
          <Input
            id="firstName"
            autoComplete="given-name"
            value={values.firstName}
            onChange={set("firstName")}
            {...invalidProps("firstName", errors.firstName?.[0])}
          />
        </FormField>
        <FormField id="lastName" label="Last name" error={errors.lastName?.[0]}>
          <Input
            id="lastName"
            autoComplete="family-name"
            value={values.lastName}
            onChange={set("lastName")}
            {...invalidProps("lastName", errors.lastName?.[0])}
          />
        </FormField>
      </div>
      <FormField
        id="reason"
        label="Reason for consultation"
        error={errors.reason?.[0]}
      >
        <Textarea
          id="reason"
          rows={3}
          value={values.reason}
          onChange={set("reason")}
          {...invalidProps("reason", errors.reason?.[0])}
        />
      </FormField>
      <FormField
        id="scheduledAt"
        label="Date and time"
        error={errors.scheduledAt?.[0]}
      >
        <Input
          id="scheduledAt"
          type="datetime-local"
          min={toLocalInput(new Date())}
          value={values.scheduledAt}
          onChange={set("scheduledAt")}
          {...invalidProps("scheduledAt", errors.scheduledAt?.[0])}
        />
      </FormField>
      <FormError message={submit.formError} />
      <DialogFooter>
        <DialogClose render={<Button variant="outline" type="button" />}>
          Cancel
        </DialogClose>
        <Button type="submit" disabled={submit.pending}>
          {submit.pending ? "Booking…" : "Book"}
        </Button>
      </DialogFooter>
    </form>
  );
}

export function RescheduleDialog({
  consultation,
  open,
  onOpenChange,
  ...rest
}: Common & { consultation: ConsultationJson | null }) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Reschedule consultation</DialogTitle>
          {consultation && (
            <DialogDescription>
              {consultation.reason}, currently{" "}
              {formatDateTime(consultation.scheduledAt)}
            </DialogDescription>
          )}
        </DialogHeader>
        {consultation && (
          <RescheduleForm consultation={consultation} {...rest} />
        )}
      </DialogContent>
    </Dialog>
  );
}

function RescheduleForm({
  consultation,
  ...callbacks
}: Callbacks & {
  consultation: ConsultationJson;
}) {
  const [value, setValue] = useState(() =>
    toLocalInput(new Date(consultation.scheduledAt)),
  );
  const [submit, setSubmit] = useState<Submit>(idle);
  const error = submit.fieldErrors.scheduledAt?.[0];

  function onSubmit(event: React.SubmitEvent<HTMLFormElement>) {
    event.preventDefault();
    const when = readDateTime(value);
    const result = futureDateTime.safeParse(when.iso);
    if (when.error || !result.success) {
      const message = when.error ?? result.error?.issues[0]?.message;
      return setSubmit({
        ...idle,
        fieldErrors: { scheduledAt: [message ?? "Not valid"] },
      });
    }
    void send(
      () =>
        apiFetch(`/api/consultations/${consultation.id}/reschedule`, {
          method: "POST",
          body: JSON.stringify({ scheduledAt: result.data }),
        }),
      callbacks,
      setSubmit,
    );
  }

  return (
    <form noValidate onSubmit={onSubmit} className="flex flex-col gap-4">
      <FormError message={submit.formError} />
      <FormField id="newScheduledAt" label="New date and time" error={error}>
        <Input
          id="newScheduledAt"
          type="datetime-local"
          min={toLocalInput(new Date())}
          value={value}
          onChange={(event) => setValue(event.target.value)}
          {...invalidProps("newScheduledAt", error)}
        />
      </FormField>
      <DialogFooter>
        <DialogClose render={<Button variant="outline" type="button" />}>
          Close
        </DialogClose>
        <Button type="submit" disabled={submit.pending}>
          {submit.pending ? "Rescheduling…" : "Reschedule"}
        </Button>
      </DialogFooter>
    </form>
  );
}

export function CancelDialog({
  consultation,
  open,
  onOpenChange,
  ...callbacks
}: Common & { consultation: ConsultationJson | null }) {
  const [submit, setSubmit] = useState<Submit>(idle);

  function changeOpen(next: boolean) {
    if (!next) setSubmit(idle);
    onOpenChange(next);
  }

  function confirm() {
    if (!consultation) return;
    void send(
      () =>
        apiFetch(`/api/consultations/${consultation.id}/cancel`, {
          method: "POST",
        }),
      callbacks,
      setSubmit,
    );
  }

  return (
    <AlertDialog open={open} onOpenChange={changeOpen}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Cancel this consultation?</AlertDialogTitle>
          {consultation && (
            <AlertDialogDescription>
              {formatDateTime(consultation.scheduledAt)}: {consultation.reason}.
              A cancelled consultation can&apos;t be rescheduled or reopened.
            </AlertDialogDescription>
          )}
        </AlertDialogHeader>
        <FormError message={submit.formError} />
        <AlertDialogFooter>
          <AlertDialogCancel>Keep it</AlertDialogCancel>
          <Button
            variant="destructive"
            disabled={submit.pending}
            onClick={confirm}
          >
            {submit.pending ? "Cancelling…" : "Cancel consultation"}
          </Button>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
