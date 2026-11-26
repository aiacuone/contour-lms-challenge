# 0005. Data access: supabase-js behind a data module

Status: accepted

## Context

The API routes need to read and write consultations. [ADR 0003](0003-access-control.md) requires every user request to query the database as the logged-in user, never with the service-role key, so row-level security applies. [ADR 0004](0004-role-storage.md) keeps roles in a `user_roles` table read by `is_admin()`. The Supabase client library is part of the required stack, and other packages may be added.

Facts that shaped the choice:

- Prisma connects to Postgres with a privileged role that bypasses row-level security. Keeping RLS needs a per-request transaction that switches to the user's role and sets the user's claims, which Prisma shows only as an example extension.
- Drizzle can define RLS policies in its TypeScript schema, but applying them per request also needs a copied wrapper, and it also connects with a privileged role.
- Several routes (list, reschedule, cancel, mark complete) work on the same table.

## Options considered

**Option 1: supabase-js behind a data module.** Routes call small typed functions in one module, which use the logged-in user's Supabase client and generated database types.

- Every query runs as the logged-in user, so RLS always applies.
- One place for database calls, easy to test and change.
- Types are generated from the schema.
- Supabase's query builder is less expressive than an ORM for complex queries.
- Does not show ORM experience.

**Option 2: Prisma.** Queries go through Prisma over a direct database connection.

- A widely used, expressive, typed ORM.
- Bypasses RLS by default, so one query outside the role-switching wrapper leaks data.
- The schema lives in both the Prisma schema and the SQL migrations.
- Two database clients (Supabase for auth, Prisma for data).

**Option 3: Drizzle.** Queries go through Drizzle, with policies in its TypeScript schema and a per-request wrapper.

- Policies and schema in one TypeScript source, with expressive typed queries.
- A privileged connection, so one query outside the wrapper leaks data.
- Two database clients.

**Option 4: supabase-js inline in routes.** Same client as Option 1, called directly in each route with no module.

- Every query runs as the logged-in user, so RLS applies.
- The least code, with each query next to where it runs.
- Queries are repeated across routes and harder to test on their own.

## Decision

Option 1: supabase-js with the logged-in user's client, behind a data module.

The reasons given were:

- Queries are written once and reused, since several routes work on the same table.
- There is one place to test the queries, and a schema change touches one file.
- It shows a modular design.
- Row-level security always applies, because every query runs as the logged-in user.

The strongest alternative was Option 4, which is less code but repeats queries across routes.

## Consequences

- The data module takes the request's Supabase client as an argument, so it never creates its own connection and never uses the service-role key for user requests.
- Database types are generated with `supabase gen types` and regenerated after each migration.
- No ORM is used. Why Prisma was not used (it bypasses RLS by default) is explained in the README.
- Complex queries, if they come up, go into SQL functions called through the client rather than into raw SQL in TypeScript.
