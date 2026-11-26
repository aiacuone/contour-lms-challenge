# Add an API route

Every route follows the same pattern, so errors, access and validation work the same way everywhere. See [ADR 0006](../adr/0006-api-shape.md).

1. Create the route file under `app/api/`, for example `app/api/consultations/[id]/<action>/route.ts`. Use one `POST` route per action rather than one route that does several things.

2. Wrap the handler in `withErrorHandling`, so any thrown error becomes `{ error: { code, message } }` with the right status:

   ```ts
   export const POST = withErrorHandling(async (request: Request, context: RouteContext<"/api/...">) => {
     // steps 3 to 6
   });
   ```

3. Check access first, before reading the body:
   - `const session = await requireUser();` for any logged-in user (401 otherwise),
   - `const session = await requireAdmin();` for admin-only routes (403 otherwise).

4. Validate the body with a narrow zod schema that rejects unknown fields (`z.strictObject`), then `await parseBody(request, schema)`. It answers 400 with a message per field. Put schemas in `lib/api/`.

5. For an action on one consultation, load it with `loadOwnConsultation(session, id)` (404 if it is not the user's), then check its rule with `assertRule(...)` from `lib/rules/consultations.ts` (409 if not allowed). Add new rules there and to the database trigger, with the same message.

6. Read or write only through `lib/data/consultations.ts`, passing `session.supabase`. Never use the secret key in a route.

7. Return `NextResponse.json(...)` with the result mapped by `toConsultationJson`, and status 201 when something was created.

8. Run the checks:

   ```
   npm run check
   ```
