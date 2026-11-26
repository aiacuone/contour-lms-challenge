-- Demo data for local development. Runs after the migrations on
-- `npx supabase db reset`. All passwords are "password123" (local only).
--
--   admin@example.com    admin
--   student@example.com  student with a few consultations
--   sam@example.com      second student, so the admin list shows more than one

-- Users -----------------------------------------------------------------------

insert into auth.users (
  instance_id, id, aud, role, email, encrypted_password, email_confirmed_at,
  raw_app_meta_data, raw_user_meta_data, created_at, updated_at,
  confirmation_token, email_change, email_change_token_new, recovery_token
)
select
  '00000000-0000-0000-0000-000000000000', u.id, 'authenticated', 'authenticated', u.email,
  extensions.crypt('password123', extensions.gen_salt('bf')), now(),
  '{"provider":"email","providers":["email"]}', '{}', now(), now(),
  '', '', '', ''
from (values
  ('a0000000-0000-4000-8000-000000000001'::uuid, 'admin@example.com'),
  ('a0000000-0000-4000-8000-000000000002'::uuid, 'student@example.com'),
  ('a0000000-0000-4000-8000-000000000003'::uuid, 'sam@example.com')
) as u (id, email);

insert into auth.identities (
  id, user_id, provider_id, identity_data, provider, last_sign_in_at, created_at, updated_at
)
select
  gen_random_uuid(), u.id, u.id::text,
  jsonb_build_object('sub', u.id::text, 'email', u.email, 'email_verified', true),
  'email', now(), now(), now()
from auth.users as u
where u.email in ('admin@example.com', 'student@example.com', 'sam@example.com');

-- Roles -----------------------------------------------------------------------

insert into public.user_roles (user_id, role)
values ('a0000000-0000-4000-8000-000000000001', 'admin');

-- Consultations ---------------------------------------------------------------
-- Booked first with future times, then moved to their state, so the seed
-- follows the same rules as the app.

insert into public.consultations (id, student_id, first_name, last_name, reason, scheduled_at)
values
  ('c0000000-0000-4000-8000-000000000001', 'a0000000-0000-4000-8000-000000000002',
   'Mia', 'Nguyen', 'Study plan for exam season', date_trunc('hour', now()) + interval '4 days 15 hours'),
  ('c0000000-0000-4000-8000-000000000002', 'a0000000-0000-4000-8000-000000000002',
   'Mia', 'Nguyen', 'Essay feedback', date_trunc('hour', now()) + interval '7 days 16 hours'),
  ('c0000000-0000-4000-8000-000000000003', 'a0000000-0000-4000-8000-000000000002',
   'Mia', 'Nguyen', 'Chemistry revision', date_trunc('hour', now()) + interval '2 days 14 hours'),
  ('c0000000-0000-4000-8000-000000000004', 'a0000000-0000-4000-8000-000000000002',
   'Mia', 'Nguyen', 'Subject selection', date_trunc('hour', now()) + interval '3 days 11 hours'),
  ('c0000000-0000-4000-8000-000000000005', 'a0000000-0000-4000-8000-000000000003',
   'Sam', 'Patel', 'Exam preparation', date_trunc('hour', now()) + interval '6 days 9 hours');

update public.consultations set status = 'completed'
where id = 'c0000000-0000-4000-8000-000000000003';

update public.consultations set status = 'cancelled'
where id = 'c0000000-0000-4000-8000-000000000004';
