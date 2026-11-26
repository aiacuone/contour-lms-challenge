import { NextResponse } from "next/server";

import { logger } from "@/lib/logger";

// One error shape for every API response: { error: { code, message } }.
// See docs/adr/0006-api-shape.md.

export type ErrorCode =
  | "bad_request"
  | "unauthorized"
  | "forbidden"
  | "not_found"
  | "conflict"
  | "rate_limited"
  | "internal";

const STATUS: Record<ErrorCode, number> = {
  bad_request: 400,
  unauthorized: 401,
  forbidden: 403,
  not_found: 404,
  conflict: 409,
  rate_limited: 429,
  internal: 500,
};

export type ErrorBody = {
  error: { code: ErrorCode; message: string; details?: unknown };
};

export class ApiError extends Error {
  readonly code: ErrorCode;
  readonly status: number;
  readonly details?: unknown;

  constructor(
    code: ErrorCode,
    message: string,
    options?: { details?: unknown; cause?: unknown },
  ) {
    super(message, { cause: options?.cause });
    this.name = "ApiError";
    this.code = code;
    this.status = STATUS[code];
    this.details = options?.details;
  }
}

function describe(error: unknown) {
  if (error instanceof Error) {
    return { name: error.name, message: error.message, cause: error.cause };
  }
  return { value: error };
}

// Turns any thrown value into the shared shape. Unexpected errors are logged
// in full and returned as a generic 500, so internals never reach the client.
export function errorResponse(error: unknown): NextResponse<ErrorBody> {
  if (error instanceof ApiError && error.status < 500) {
    const body: ErrorBody = {
      error: {
        code: error.code,
        message: error.message,
        ...(error.details === undefined ? {} : { details: error.details }),
      },
    };
    return NextResponse.json(body, { status: error.status });
  }

  logger.error("request failed", { error: describe(error) });
  return NextResponse.json<ErrorBody>(
    { error: { code: "internal", message: "Something went wrong." } },
    { status: 500 },
  );
}

// Wraps a route handler so any thrown error becomes the shared shape.
export function withErrorHandling<Args extends unknown[]>(
  handler: (...args: Args) => Promise<Response>,
) {
  return async (...args: Args): Promise<Response> => {
    try {
      return await handler(...args);
    } catch (error) {
      return errorResponse(error);
    }
  };
}
