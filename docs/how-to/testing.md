# Run and add tests

The tests use Vitest and run against the local Supabase database. See [ADR 0010](../adr/0010-testing-tools.md).

1. Start the local database if it is not running:

   ```
   npx supabase start
   ```

2. Run every test:

   ```
   npm test
   ```

   To run one file while working on it:

   ```
   npx vitest tests/database.test.ts
   ```

3. Pick the file for a new test:
   - `tests/database.test.ts` for row-level security, column grants and the rules trigger, queried directly as each seeded user,
   - `tests/routes.test.ts` for an API route: add a row to the access matrix for every user, then its own cases.

4. Make the rows a test needs with `makeConsultation(owner, status)` from `tests/support.ts`, and query as a user with the clients from `clientsForAll()`. Check what is in the database afterwards with `readRow(id)`.

5. Give every row a test creates a reason starting with `test:` (use `TEST_REASON`). The tests delete only those rows when they finish, so the seed and your own data stay as they are.

6. Make sure a new test can fail: break the rule it covers, run it, then put the rule back.

## Notes

- The seeded users are logged-out (`anon`), Mia (`student@example.com`), Sam (`sam@example.com`) and the admin (`admin@example.com`), all with the password `password123`.
- Route tests call the handlers directly. Only the cookie-based Supabase client is swapped for one logged in as the test's user, so the access checks, rules and RLS are all real.
- The secret key in `tests/support.ts` is only for making and removing rows, never for checking access.
