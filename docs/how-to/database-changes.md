# Change the database schema

Schema changes are SQL migration files in `supabase/migrations`, applied in name order. Never edit a migration that has been pushed; add a new one.

1. Start the local database if it is not running:

   ```
   npx supabase start
   ```

2. Create a new migration file:

   ```
   npx supabase migration new <short_name>
   ```

3. Write the SQL in the new file under `supabase/migrations/`. For a new table or column:
   - turn on row-level security and add the policies it needs,
   - grant only the columns clients may write (`grant insert (...)`, `grant update (...)`),
   - add a comment on every timestamp column saying what it means.

4. Rebuild the local database from all migrations and the seed file:

   ```
   npx supabase db reset
   ```

5. Regenerate the TypeScript types and the readable schema file, `supabase/schema.sql`:

   ```
   npm run db:types
   npm run db:schema
   ```

6. Run the checks:

   ```
   npm run typecheck
   npm test
   ```

   For a new policy, grant or rule, add tests for it first; see [testing.md](testing.md).

7. Commit the migration and `lib/database.types.ts` together.
