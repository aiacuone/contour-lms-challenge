# contour-lms-challenge

A mini learning management system for booking and managing consultations, built with Next.js and Supabase.

The setup steps, implementation summary, assumptions and next steps are added as the build progresses. Key design decisions are recorded as ADRs in [docs/adr](docs/adr/README.md).

## Technical choices

Smaller choices that do not need a full decision record.

| Choice | Decision | Why |
|---|---|---|
| UI library | shadcn/ui (Radix and Tailwind), with components copied into the repo | Readable component code in the repo, fewer custom UI lines to review, and works in server components. Alternatives were MUI, Mantine and Tailwind UI |
| Next.js version | Next.js 16, app router | Current, and matches the `proxy.ts` session refresh from [ADR 0001](docs/adr/0001-starting-point.md) |
| TypeScript | Strict mode; typecheck runs separately from the build | Catches more mistakes early |
| Package manager | npm | Nothing extra to install |
| Node version | Pinned in `.nvmrc` | The same Node locally and in CI |
| Lint and format | ESLint (Next's default) plus Prettier, enforced by a command | Comes with the Next.js setup and is widely known |
| Supabase | Runs locally with the Supabase CLI; migrations in `supabase/migrations` | Everything runs offline, and the migrations are part of the deliverable |
| Base timestamps | `created_at` (when booked, never changes) and `updated_at` (last change by anything, used for nothing else), each commented in the migration | Standard columns with one meaning each ([ADR 0007](docs/adr/0007-consultation-state.md)) |
| Date and time | Stored as `timestamptz` in UTC, shown in the user's time zone | Avoids time zone bugs |
| Work tracking | Issues in this repo | The process can be followed alongside the code |
| Packaging | Built from a clean `git archive` | Secrets and local files cannot end up in the package |
| Quality baseline | ADRs, unit and integration tests, lint and format, typecheck, run instructions, README and seed data | Each is cheap and expected of a finished project |
