select u.id, u.email, coalesce(r.role::text, 'student') as role
from auth.users u
left join public.user_roles r on r.user_id = u.id
order by u.email;