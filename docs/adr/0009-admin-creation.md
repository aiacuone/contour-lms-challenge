# 0009. Creating admins: a seed file plus a promote script

Status: accepted

## Context

[ADR 0004](0004-role-storage.md) keeps roles in a `user_roles` table with no write policies, so only migrations, seed files and the service role can change roles. A reviewer runs the app locally and needs to reach the admin view quickly. An admin also needs to be creatable outside a local setup.

Facts that shaped the choice:

- Local Supabase has email confirmation off by default, so any rule that grants admin by email at sign-up can be claimed by whoever signs up with that email.
- A database trigger cannot read the app's environment variables.

## Options considered

**Option 1: Seed file plus a promote script.** `supabase/seed.sql` creates a demo admin and a demo student, and `npm run promote -- <email>` makes any existing user an admin using the service-role key.

- A working admin right after setup, and known logins for end-to-end tests.
- Works in any environment, for any number of admins.
- One more script, which reads the service-role key when run.

**Option 2: Seed file only.** The same seed; any other admin needs a hand-written SQL insert.

- The least code.
- Anywhere other than local needs hand-written SQL.

**Option 3: Admin email allowlist.** Emails in a setting get the admin role at sign-up.

- Admins set by configuration.
- Unsafe while email confirmation is off, and the list has to reach the database.

**Option 4: First user becomes admin.**

- No setup.
- Whoever signs up first wins, and there is only one admin.

## Decision

Option 1: a seed file for the demo users, plus a promote script.

The reasons given were:

- Running a script is easier than finding the database tool and writing SQL.
- The same command works in any environment.
- The seeded admin works straight after setup.

The strongest alternative was Option 2, which is less code but leaves promotion to hand-written SQL.

## Consequences

- `supabase/seed.sql` creates `admin@example.com` (admin) and `student@example.com` (student) with passwords given in the README, plus a few sample consultations.
- `npm run promote -- <email>` looks the user up, inserts an `admin` row into `user_roles`, and reports clearly if the user does not exist or is already an admin.
- The script reads the service-role key from the environment when run. The app itself never uses that key for user requests.
- The README lists the demo logins and the promote command.
