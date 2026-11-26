# 0003. Access control: row-level security plus API route checks

Status: accepted

## Context

Students must only see and change their own consultations, and an admin must be able to read every consultation. The app's server work goes through API routes, and the login session is carried in cookies using the Supabase auth wiring from [ADR 0001](0001-starting-point.md), so the server can talk to the database as the logged-in user. Security is a core concern for the app. Where the role itself is stored is a separate decision.

Facts that shaped the choice:

- Postgres row-level security (RLS) applies when the database is queried as the logged-in user. The service-role key bypasses it.
- When RLS denies access to rows it returns no rows, not an error, so a missing or wrong policy can fail silently.

## Options considered

**Option 1: RLS only.** Database policies decide who sees what. API routes query as the logged-in user and do not check roles themselves.

- The database enforces the rule, so a forgotten check in code cannot leak other students' data.
- Supabase's standard approach, with the rules in one SQL migration.
- Policies are easy to get wrong silently and need database-level tests.
- An admin check inside a policy needs care to avoid recursion and slow queries.
- A non-admin on the admin route gets an empty list rather than a clear refusal.

**Option 2: App-level checks only.** API routes use the service-role key and check session, role and ownership in TypeScript.

- Plain TypeScript that is easy to read and unit test.
- One missed check in any route leaks data.
- The server holds a key that bypasses every database rule.
- Not using RLS has to be justified.

**Option 3: Both layers.** RLS policies enforce row access, and API routes also check the session and the role and validate input.

- A gap in one layer is caught by the other.
- Non-admins get a clear 403 on admin routes.
- Roles are visible in both the routes and the policies.
- More code and more to explain.
- The rules live in two places and could drift apart.

## Decision

Option 3: row-level security in the database plus session, role and input checks in the API routes.

The reasons given were:

- The two layers can be kept from drifting apart (see Consequences).
- A mistake in one layer is caught by the other.
- A non-admin gets a clear 403 instead of a silent empty list.

The strongest alternative was Option 1, which is less code but fails silently when a policy is wrong.

## Consequences

To keep the two layers from drifting:

- The role rule is written once, as a SQL function (for example `is_admin()`). The RLS policies use it, and the admin API route calls the same function, rather than repeating the check in TypeScript.
- The layers have separate jobs. API routes check that a user is logged in (401), that the user is an admin on admin routes (403), and that input is valid. The database decides which rows a user may see or change. Routes never filter by user id themselves.
- One test matrix covers both layers: logged out, two different students and an admin, each trying to list, create, reschedule, cancel and read the admin list. It runs through the API and directly against the database as each user, so RLS is proven to hold even without the route checks.
- TypeScript types are generated from the database schema, so role values in code match the database.

Also:

- API routes must use the logged-in user's database connection, never the service-role key, for user requests.
- There is more code to write and test than with either single layer.
