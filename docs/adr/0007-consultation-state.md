# 0007. Consultation state: one status column

Status: accepted

## Context

A consultation can be marked complete or incomplete, cancelled and rescheduled. [ADR 0006](0006-api-shape.md) gives each of these its own API route. Every option shares the same base columns on `consultations`: the student, first name, last name, reason, `scheduled_at` (when the consultation happens), `created_at` (when it was booked, never changes) and `updated_at` (when the row last changed, by anything).

Facts that shaped the choice:

- Nothing in the app needs to show when a consultation was completed or cancelled, or by whom.
- Every timestamp should have exactly one meaning, so a newcomer can't misread one, such as reading `updated_at` as the cancel time.

## Options considered

**Option 1: Status column.** One `status` enum: `booked`, `completed` or `cancelled`.

- Impossible states such as completed and cancelled at once cannot happen.
- One field to filter and show, and a new state is a new value.
- No record of when, by whom, or the old time after a reschedule.

**Option 2: Timestamps.** Nullable `completed_at` and `cancelled_at`, with a check that both are not set.

- Each timestamp has one meaning and records when it happened.
- Needs a rule to block impossible combinations, and the state is worked out from two columns.
- Marking incomplete clears `completed_at`, and reschedules and who made a change are not recorded.

**Option 3: Status plus timestamps.** The status column plus `completed_at` and `cancelled_at`, kept in step by a trigger or rule.

- A simple status plus a record of when.
- Two sources that must always agree.

**Option 4: Status plus an events table.** The status column plus a `consultation_events` table, written by a trigger, recording every action with who, when and the old and new time.

- Every question about history has a column built for it.
- One more table, a trigger, row-level security and tests to build.

## Decision

Option 1: a single `status` column.

The reasons given were:

- Each column has one clear meaning, and the state is one field.
- The status is set only by the API routes, one value per route, and is never sent by the client.
- History (when and by whom) is not needed by the app, so it is not worth an extra table.
- Impossible states cannot happen.

The strongest alternative was Option 2, which records when things happened with one meaning per column.

## Consequences

| Column | Means | Changes when |
|---|---|---|
| `scheduled_at` | When the consultation happens | Booked or rescheduled |
| `created_at` | When it was booked | Never |
| `updated_at` | When the row last changed, by anything | Every change |
| `status` | Current state: `booked`, `completed` or `cancelled` | Marked complete or incomplete, or cancelled |

- Each column's meaning is written as a comment in the migration. `updated_at` is never used as a completion or cancellation time.
- `status` is a Postgres enum with a default of `booked`. Routes set it: complete sets `completed`, incomplete sets `booked`, cancel sets `cancelled`, and reschedule leaves it alone.
- When, by whom and earlier times are not recorded. An events table is the way to add this later.
