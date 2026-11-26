# 0004. Role storage: a user_roles table read directly

Status: accepted

## Context

[ADR 0003](0003-access-control.md) enforces access with database policies and API route checks that share one SQL function, `is_admin()`. That function needs somewhere to read the user's role from. The app has two roles today, student and admin, and roles are a visible part of the design, so they should be clear in the schema. Security and the ability to grow are both important.

Facts that shaped the choice:

- Supabase's documented role-based access pattern keeps roles in a `user_roles` table and copies them into the login token with a Custom Access Token Hook. The hook needs extra configuration locally and in the hosted project.
- A role copied into the login token stays as it was until the token refreshes (about an hour), so a demoted admin keeps access until then.
- Users will edit their own profile details, so a role column on a user-editable row needs its own lock.
- A policy that reads the table it protects can recurse. A `security definer` function with a fixed `search_path` avoids that.

## Options considered

**Option 1: `profiles` table with a role column.** Created at sign-up; `is_admin()` reads the column.

- Simple: one column and one function, and role changes apply at once.
- Users edit their own profile row, so the role column needs a lock that is easy to forget.
- One role per user; new roles mean changing the column type.

**Option 2: Claim in the login token.** The role sits in the auth user's `app_metadata`; `is_admin()` reads the token.

- No table and no lookup, and users cannot edit `app_metadata`.
- The role is stale until the token refreshes.
- Setting a role needs a server script with the service-role key, and the role is not in the app's migrations.
- One role string per user.

**Option 3: Roles table plus auth hook.** Supabase's documented pattern: a `user_roles` table copied into the token by a hook.

- Supports many roles and permissions without schema changes.
- Needs hook setup in local config, the hosted dashboard and database grants.
- The role is stale until the token refreshes.
- More moving parts than two roles need.

**Option 4: `user_roles` table, read directly.** A separate table of (user, role) with no write policies; `is_admin()` reads it directly, with no hook.

- Users have no way to write to it, so there is no lock to forget.
- Role changes apply on the next request.
- Supports several roles per user, and adding the hook later turns it into Option 3.
- One more table than Option 1.

## Decision

Option 4: a `user_roles` table, read directly by `is_admin()`.

The reasons given were:

- It scales to more roles, and can grow into Supabase's documented pattern later.
- Role changes apply at once, with no token lag.
- Users cannot write to the table.
- It stays close to Supabase's documented pattern without the hook setup.

The strongest alternative was Option 1, which is one table fewer but puts the role in a row users can edit.

## Consequences

- `user_roles` has row-level security turned on with no insert, update or delete policies, so only migrations, seed scripts and the service role can change roles. Users may read their own rows.
- `is_admin()` is a `security definer` function with `set search_path = ''`, and policies call it as `(select is_admin())` so it runs once per query rather than once per row.
- A new user gets no row and is treated as a student, or gets a `student` row from a sign-up trigger (to settle with the data model).
- Adding a Custom Access Token Hook later would move the check into the token, at the cost of the refresh lag. This is a note for future work, not part of this build.
