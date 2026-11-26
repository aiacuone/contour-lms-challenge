import { z } from "zod";

import { ApiError } from "@/lib/api/errors";

// Reads a JSON body and validates it. Invalid JSON or invalid fields become a
// 400 in the shared error shape, with one message list per field in details.
export async function parseBody<Schema extends z.ZodType>(
  request: Request,
  schema: Schema,
): Promise<z.infer<Schema>> {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    throw new ApiError("bad_request", "The request body must be valid JSON.");
  }

  const result = schema.safeParse(body);
  if (!result.success) {
    throw new ApiError("bad_request", "Some fields are not valid.", {
      details: z.flattenError(result.error).fieldErrors,
    });
  }
  return result.data;
}
