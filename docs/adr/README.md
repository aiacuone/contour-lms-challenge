# Architecture decision records

Each record explains one decision: the options considered, what was chosen and why. Numbers 0002 and 0011 were folded into the [README's Technical choices table](../../README.md#technical-choices), so they are not listed here.

## Key decisions

| ADR | Outcome |
|---|---|
| [0003 Access control](0003-access-control.md) | Row-level security plus session, role and input checks in the API routes, sharing one SQL `is_admin()` |
| [0004 Role storage](0004-role-storage.md) | A `user_roles` table with no write policies, read directly by `is_admin()` |
| [0005 Data access](0005-data-access.md) | supabase-js with the logged-in user's client, behind a typed data module |
| [0006 API shape](0006-api-shape.md) | REST collection routes plus one `POST` route per action |
| [0007 Consultation state](0007-consultation-state.md) | One `status` column: booked, completed or cancelled |
| [0008 Cancel and reschedule rules](0008-cancel-and-reschedule-rules.md) | Soft cancel; rules enforced in the routes and a database trigger |

## Supporting choices

| ADR | Outcome |
|---|---|
| [0001 Starting point](0001-starting-point.md) | Blank Next.js app plus the template's four Supabase auth files |
| [0009 Admin creation](0009-admin-creation.md) | Seed file for demo users plus `npm run promote -- <email>` |
| [0010 Testing tools](0010-testing-tools.md) | Vitest for unit, integration and database tests; Playwright for one end-to-end path and an accessibility check |
