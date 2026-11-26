-- Initial schema: roles, the shared admin check, consultations and their
-- row-level security. See docs/adr/0003, 0004 and 0007.

create extension if not exists moddatetime with schema extensions;

-- Roles -------------------------------------------------------------------

-- A user with no row in user_roles is a student. Roles are granted only by
-- migrations, the seed file and the promote script (service role).
create type public.app_role as enum ('admin');

create table public.user_roles (
  user_id uuid not null references auth.users (id) on delete cascade,
  role public.app_role not null,
  created_at timestamptz not null default now(),
  primary key (user_id, role)
);

comment on table public.user_roles is
  'Roles granted to users. No row means the user is a student. Users can read their own rows and cannot write any.';
comment on column public.user_roles.created_at is
  'When the role was granted. Never changes.';

alter table public.user_roles enable row level security;

create policy "Users can read their own roles"
  on public.user_roles
  for select
  to authenticated
  using (user_id = (select auth.uid()));

-- No insert, update or delete policies: users cannot change roles.
revoke all on public.user_roles from anon, authenticated;
grant select on public.user_roles to authenticated;

-- The one admin check shared by the policies and the API routes.
-- security definer so it can read user_roles without going through its
-- policies, with an empty search_path so names cannot be hijacked.
create function public.is_admin()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.user_roles
    where user_id = (select auth.uid())
      and role = 'admin'
  );
$$;

comment on function public.is_admin() is
  'True when the logged-in user has the admin role. Used by RLS policies and the admin API route.';

revoke execute on function public.is_admin() from public, anon;
grant execute on function public.is_admin() to authenticated;

-- Consultations -------------------------------------------------------------

create type public.consultation_status as enum ('booked', 'completed', 'cancelled');

create table public.consultations (
  id uuid primary key default gen_random_uuid(),
  student_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  first_name text not null check (char_length(first_name) between 1 and 80),
  last_name text not null check (char_length(last_name) between 1 and 80),
  reason text not null check (char_length(reason) between 1 and 500),
  scheduled_at timestamptz not null,
  status public.consultation_status not null default 'booked',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

comment on table public.consultations is
  'Consultations booked by students. Cancelled ones are kept (soft cancel).';
comment on column public.consultations.student_id is
  'The student who booked it. Set from the logged-in user.';
comment on column public.consultations.scheduled_at is
  'When the consultation happens. Changed only by booking or rescheduling.';
comment on column public.consultations.status is
  'Current state: booked (not yet complete), completed or cancelled. Set only by the API routes.';
comment on column public.consultations.created_at is
  'When it was booked. Never changes.';
comment on column public.consultations.updated_at is
  'When the row last changed, by anything. Not used as a completion or cancellation time.';

create index consultations_student_id_scheduled_at_idx
  on public.consultations (student_id, scheduled_at);
create index consultations_scheduled_at_idx
  on public.consultations (scheduled_at desc);

create trigger consultations_set_updated_at
  before update on public.consultations
  for each row
  execute procedure extensions.moddatetime (updated_at);

alter table public.consultations enable row level security;

create policy "Students read their own consultations and admins read all"
  on public.consultations
  for select
  to authenticated
  using (student_id = (select auth.uid()) or (select public.is_admin()));

create policy "Students book consultations for themselves"
  on public.consultations
  for insert
  to authenticated
  with check (student_id = (select auth.uid()));

create policy "Students change their own consultations"
  on public.consultations
  for update
  to authenticated
  using (student_id = (select auth.uid()))
  with check (student_id = (select auth.uid()));

-- No delete policy: cancelling keeps the row.

-- Column privileges limit what a client can write, whatever it sends.
revoke all on public.consultations from anon, authenticated;
grant select on public.consultations to authenticated;
grant insert (first_name, last_name, reason, scheduled_at) on public.consultations to authenticated;
grant update (scheduled_at, status) on public.consultations to authenticated;
