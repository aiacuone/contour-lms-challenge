# 0010. Testing tools: Vitest and Playwright

Status: accepted

## Context

The app needs unit and integration tests, a light end-to-end test and an automated accessibility check. [ADR 0003](0003-access-control.md) and [ADR 0008](0008-cancel-and-reschedule-rules.md) require a test matrix that proves access control and the cancel and reschedule rules both through the API routes and directly against the database as each user. Seeded users with known passwords exist ([ADR 0009](0009-admin-creation.md)). Time is short.

## Options considered

**Option 1: Vitest and Playwright.** Vitest for unit, integration and database tests, with database rules tested by signing in as each seeded user through supabase-js. Playwright for one end-to-end path plus an axe accessibility check.

- One test language for everything outside the browser.
- Database tests use the same access path as the app.
- Works with Next.js and TypeScript with little setup.
- Database rules are tested through the client rather than in SQL.

**Option 2: Jest and Cypress.** The same scope with Jest and Cypress plus cypress-axe.

- Very widely known tools.
- Jest needs more configuration for this stack, and Cypress is slower and heavier.

**Option 3: Vitest, pgTAP and Playwright.** As Option 1, but the database tests are written in SQL with pgTAP.

- Database rules tested where they live, with Supabase's documented tool.
- Three tools, tests in two languages, and user logins faked in SQL.

**Option 4: Vitest only.** No end-to-end test or accessibility check.

- One tool, fastest to set up.
- Nothing tests the real pages in a browser.

## Decision

Option 1: Vitest and Playwright.

The reasons given were:

- One test language covers unit, integration and database tests.
- It needs the least setup.

The strongest alternative was Option 3, which tests the database rules in SQL but adds a third tool.

## Consequences

- `npm test` runs Vitest against the local Supabase started by the CLI: unit tests, route integration tests, and database tests signed in as each seeded user.
- The test matrix covers logged out, two students and the admin for every action, through the routes and directly through supabase-js.
- `npm run test:e2e` runs Playwright against a production build on its own port: one happy path (log in, book, reschedule, complete, cancel, admin list) and an axe accessibility check.
- SQL-level database tests with pgTAP are a "with more time" item.
