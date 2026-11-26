# 0008. Cancel and reschedule rules: soft cancel, enforced in the routes and the database

Status: accepted

## Context

Students can cancel and reschedule their own consultations and mark them complete or incomplete. The admin sees a list of all consultations. [ADR 0007](0007-consultation-state.md) stores the state as one `status` column (`booked`, `completed`, `cancelled`), and [ADR 0006](0006-api-shape.md) gives each action its own route. The exact rules are not specified, so they are stated here as assumptions.

Facts that shaped the choice:

- The project already uses SQL functions, triggers and policies (migrations, row-level security, `is_admin()`, the `updated_at` trigger), so a rules trigger is not a new kind of code.
- A rules trigger is roughly 30 to 40 lines of SQL plus database tests.

## Options considered

**Option 1: Soft cancel, rules in the routes.** Cancel keeps the row with `status = cancelled`; each action route checks the rules and returns 409 for an invalid move.

- Cancelled consultations stay visible to the admin, and the rules are in one place.
- A bug in a route could let a bad move through, since the database does not check.

**Option 2: Soft cancel, rules in the routes and the database.** The same rules, also enforced by a database trigger.

- The database blocks bad moves even if a route is wrong or a write bypasses the API.
- The rules are written twice and can drift, so both need tests.

**Option 3: Delete on cancel.** Cancel deletes the row.

- The simplest flow.
- Cancelled consultations vanish from the admin list, and a mistaken cancel cannot be undone.

**Option 4: Soft cancel, no rules.** Any action at any time.

- The least logic.
- Allows odd states such as rescheduling a cancelled consultation into the past.

## Decision

Option 2: soft cancel, with the rules enforced in both the API routes and a database trigger.

The reasons given were:

- The extra cost is small.
- Bad moves are blocked even if a route has a bug or a write bypasses the API.

The strongest alternative was Option 1, which keeps the rules in one place but relies on the routes alone.

## Consequences

The rules (stated as assumptions in the README):

- Only a `booked` consultation can be rescheduled or cancelled.
- `cancelled` is final.
- Complete and incomplete apply only when the consultation is not cancelled.
- Booking and rescheduling must be for a time in the future.

Enforcement:

- Each action route checks its rule first and returns 409 with the shared error shape.
- A `before insert or update` trigger on `consultations` enforces the same rules and raises an error if a bad move reaches the database. The data module maps that error to the same 409.
- The rules exist in two places, so the test matrix covers both: through the routes, and directly against the database.
