# contour-lms-challenge

A mini learning management system for booking and managing consultations, built with Next.js and Supabase.

The setup steps, implementation summary, assumptions and next steps are added as the build progresses. Key design decisions are recorded as ADRs in [docs/adr](docs/adr/README.md). Low-detail [wireframes](docs/wireframes/index.html) of the screens are in `docs/wireframes`.

## Technical choices

Smaller choices that do not need a full decision record.

| Choice | Decision | Why |
|---|---|---|
| UI library | shadcn/ui (Base UI and Tailwind), with components copied into the repo | Readable component code in the repo, fewer custom UI lines to review, and works in server components. Alternatives were MUI, Mantine and Tailwind UI |
| Admin list emails | An admin-only database function, `admin_consultations()`, joins each student's email into the admin list | Emails live in `auth.users`, which the API cannot read; the function checks `is_admin()` itself and returns no rows to anyone else |
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
| Security headers | Content-Security-Policy, `nosniff`, `X-Frame-Options: DENY`, referrer and permissions policies, HSTS, set in `next.config.ts` | Cheap defence in depth. Scripts allow `'unsafe-inline'` because Next.js adds inline scripts; a per-request nonce would remove that but make every page dynamic |
| Rate limiting | 60 API requests a minute per user (or IP when logged out), in memory, answering 429 | Slows a script hammering the API. The counts reset on restart and are not shared between servers; more than one instance would need a shared store such as Redis |
| Secrets | `.env.example` with placeholders; `.env*` ignored; gitleaks scans the whole history in CI | Keys never reach the repo, and a mistake is caught on push |
| CI | GitHub Actions on every push and pull request: lint and format, typecheck, secret scan, tests and end-to-end as separate jobs, with the local Supabase stack | Each failure names what broke. Superseded runs are cancelled, permissions are read-only, jobs have timeouts and actions are pinned to commit SHAs |
| Phone layout | The header wraps the admin nav onto a second row; tables keep their columns and scroll sideways in a focusable, labelled region | Keeps one table component for every width. A card layout per row would read better on a phone but doubles the markup |
| Quality baseline | ADRs, unit and integration tests, lint and format, typecheck, run instructions, README and seed data | Each is cheap and expected of a finished project |

## Next steps

- On a phone, show each consultation as a card instead of a sideways-scrolling table, so the status and actions are visible without scrolling.
