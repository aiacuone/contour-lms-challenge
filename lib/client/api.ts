import type { ErrorBody, ErrorCode } from "@/lib/api/errors";

// Browser-side calls to the app's own API. A failed response becomes a
// ClientApiError with the server's code, message and any field errors, so
// screens can show them.

export type FieldErrors = Partial<Record<string, string[]>>;

export class ClientApiError extends Error {
  readonly status: number;
  readonly code: ErrorCode | "network";
  readonly fieldErrors: FieldErrors;

  constructor(
    status: number,
    code: ErrorCode | "network",
    message: string,
    fieldErrors: FieldErrors = {},
  ) {
    super(message);
    this.name = "ClientApiError";
    this.status = status;
    this.code = code;
    this.fieldErrors = fieldErrors;
  }
}

export async function apiFetch<T>(
  path: string,
  init?: RequestInit,
): Promise<T> {
  let response: Response;
  try {
    response = await fetch(path, {
      ...init,
      headers: { "Content-Type": "application/json", ...init?.headers },
    });
  } catch {
    throw new ClientApiError(0, "network", "Couldn't reach the server.");
  }

  const body: unknown = await response.json().catch(() => null);
  if (!response.ok) {
    const error = (body as ErrorBody | null)?.error;
    // A 400 from parseBody carries one message list per field in details.
    const details = error?.details;
    const fieldErrors =
      details && typeof details === "object" ? (details as FieldErrors) : {};
    throw new ClientApiError(
      response.status,
      error?.code ?? "internal",
      error?.message ?? "Something went wrong.",
      fieldErrors,
    );
  }
  return body as T;
}

export function isUnauthorized(error: unknown): boolean {
  return error instanceof ClientApiError && error.status === 401;
}

export function errorMessage(error: unknown): string {
  return error instanceof ClientApiError
    ? error.message
    : "Something went wrong.";
}
