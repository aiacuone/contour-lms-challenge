# 0006. API shape: REST routes with one route per action

Status: accepted

## Context

The app's server work goes through API routes rather than Server Actions. Students list, create, reschedule, cancel and mark consultations complete or incomplete, and an admin reads a list of all consultations. [ADR 0003](0003-access-control.md) has routes return 401 when not logged in and 403 for non-admins on admin routes, and [ADR 0005](0005-data-access.md) has routes call a typed data module. Every option considered validates input on the server with zod and returns one error shape, `{ error: { code, message } }`, from one helper.

## Options considered

**Option 1: REST resources.** `GET`/`POST /api/consultations`, one `PATCH /api/consultations/[id]` for reschedule, complete and cancel, and `GET /api/admin/consultations`.

- Standard REST with the fewest routes.
- One PATCH carries three meanings, so its schema must accept several fields and reject mixes.
- A broad schema risks a client setting fields it should not.
- Per-action rules become branches in one handler.

**Option 2: REST with action routes.** The same list, create and admin routes, plus `POST /api/consultations/[id]/reschedule`, `/cancel` and `/complete`.

- Each action has its own narrow schema.
- Each action's rules live in its own small handler.
- Routes read like the features.
- More route files, and less "pure" REST than resource updates.

**Option 3: tRPC.** Typed procedures on one route handler, called through the tRPC client.

- End-to-end types and one schema per procedure.
- An extra library and client setup.
- Not a plain HTTP API, and close in feel to Server Actions.

**Option 4: Hono with OpenAPI.** The Hono framework in one catch-all route, generating an OpenAPI document.

- An OpenAPI document and docs page.
- A second web framework inside Next.js, with more setup.

## Decision

Option 2: REST routes for the collection and the admin list, with one `POST` route per action on a consultation.

The reasons given were:

- Each action has a narrow schema that accepts only its own fields.
- Each action's rules live in a small, separate handler.

The strongest alternative was Option 1, which is more conventional REST but puts three meanings into one PATCH.

## Consequences

Routes:

| Method and path | Purpose |
|---|---|
| `GET /api/consultations` | List the logged-in student's consultations |
| `POST /api/consultations` | Book a consultation |
| `POST /api/consultations/[id]/reschedule` | Change the date and time |
| `POST /api/consultations/[id]/cancel` | Cancel |
| `POST /api/consultations/[id]/complete` | Mark complete or incomplete (`{ completed: boolean }`) |
| `GET /api/admin/consultations` | Admin: list all consultations (read-only) |

- Every route validates its input with its own zod schema, and unknown fields are rejected.
- Every error goes through one helper with one shape and a matching HTTP status (400, 401, 403, 404, 409).
- More route files than a single PATCH, each kept small.
- Any Server Actions in the auth flow are only those that come with the template's auth pattern, and the README says so.
