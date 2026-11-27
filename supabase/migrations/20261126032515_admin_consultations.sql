-- Admin list with each student's email. Emails live in auth.users, which the
-- API cannot read, so this admin-only function joins them in.
-- See docs/adr/0003-access-control.md.

create function public.admin_consultations()
returns table (
  id uuid,
  student_id uuid,
  student_email text,
  first_name text,
  last_name text,
  reason text,
  scheduled_at timestamptz,
  status public.consultation_status,
  created_at timestamptz,
  updated_at timestamptz
)
language sql
stable
security definer
set search_path = ''
as $$
  select
    c.id,
    c.student_id,
    u.email::text,
    c.first_name,
    c.last_name,
    c.reason,
    c.scheduled_at,
    c.status,
    c.created_at,
    c.updated_at
  from public.consultations as c
  join auth.users as u on u.id = c.student_id
  -- security definer skips RLS, so the admin check is done here: anyone
  -- else gets no rows.
  where public.is_admin()
  order by c.scheduled_at desc;
$$;

comment on function public.admin_consultations() is
  'Every consultation with the student''s email, newest first. Returns rows only to admins.';

revoke execute on function public.admin_consultations() from public, anon;
grant execute on function public.admin_consultations() to authenticated;
