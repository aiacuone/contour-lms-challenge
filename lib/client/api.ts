import type { ErrorBody, ErrorCode } from "@/lib/api/errors";

// Browser-side calls to the app's own API. A failed response becomes a
// ClientApiError with the server's code and message, so screens can show it.

export class ClientApiError extends Error {
  readonly status: number;
  readonly code: ErrorCode | "network";

  constructor(status: number, code: ErrorCode | "network", message: string) {
    super(message);
    this.name = "ClientApiError";
    this.status = status;
    this.code = code;
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
    throw new ClientApiError(
      response.status,
      error?.code ?? "internal",
      error?.message ?? "Something went wrong.",
    );
  }
  return body as T;
}
