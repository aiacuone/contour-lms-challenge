# 0001. Starting point: blank Next.js app plus the template's Supabase auth files

Status: accepted

## Context

The app must use Next.js with the app router, TypeScript and Supabase (supabase-js and supabase-ssr). Vercel's official `with-supabase` example is a known starting point that already wires Supabase auth into Next.js. Time is short, and the security of the app is part of how it is judged, so the auth wiring needs to be right from the start.

Facts that shaped the choice:

- The `with-supabase` example installs Next.js and the Supabase packages as `latest`, so versions are not pinned.
- It ships demo and tutorial pages, a theme switcher and a deploy button that this app does not need.
- Its Supabase wiring is four short files: a browser client (`lib/supabase/client.ts`), a server client (`lib/supabase/server.ts`), a session refresh helper (`lib/supabase/proxy.ts`) and a root `proxy.ts` that runs the refresh on each request.

## Options considered

**Option 1: Whole template.** Create the app from the `with-supabase` example, then delete the demo content and pin the versions.

- Sign-up, login, logout and cookie sessions work from the first minute.
- shadcn/ui and Tailwind come already set up.
- A reviewer recognises the official wiring.
- Demo pages and unpinned dependencies have to be cleaned up.
- Brings more code that was not written for this app and still has to be understood.

**Option 2: Blank app, hand-wired.** Create a plain Next.js app and write the Supabase clients, session refresh and component library setup by hand.

- Every line is written for this app.
- Free choice of folder structure and versions.
- Cookie session handling is easy to get subtly wrong, which is a security risk.
- Takes noticeably longer.

**Option 3: Blank app plus the template's auth files.** Create a plain Next.js app, copy only the four Supabase auth files from the example, and set up the component library separately.

- Uses the official, tested auth wiring.
- No demo code to remove.
- Versions are pinned from the start, and the UI library stays a separate choice.
- The copy is manual, so a piece (such as the proxy path matcher or cookie handling) could be missed.
- Slightly more setup than Option 1.

## Decision

Option 3: start from a blank Next.js app and copy the template's four Supabase auth files.

The reason is to get the official, tested auth wiring without the demo code.

The strongest alternative was Option 1, which is faster to start but carries demo pages and unpinned versions.

## Consequences

- The four copied files must be checked against the example after copying, so nothing in the session handling is missed.
- Login and sign-up pages, and the component library, are built or chosen separately rather than inherited from the example (see the Technical choices table in the [README](../../README.md#technical-choices)).
- Dependency versions are pinned in `package.json` from the first commit.
