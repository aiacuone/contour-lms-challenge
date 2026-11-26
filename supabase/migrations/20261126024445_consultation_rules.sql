-- Consultation rules, enforced in the database as well as in the API routes.
-- See docs/adr/0008-cancel-and-reschedule-rules.md.
--
--   - A new consultation starts as booked, at a time in the future.
--   - Cancelled is final: a cancelled consultation can't be changed.
--   - Only a booked consultation can be rescheduled, and only to the future.
--   - Status moves allowed: booked -> completed, completed -> booked,
--     booked -> cancelled. Anything else is rejected.
--
-- Rejections raise SQLSTATE P0001 with a message the API shows as a 409.

create function public.enforce_consultation_rules()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if tg_op = 'INSERT' then
    if new.status <> 'booked' then
      raise exception 'New consultations must start as booked.'
        using errcode = 'P0001';
    end if;
    if new.scheduled_at <= now() then
      raise exception 'Consultation must be in the future.'
        using errcode = 'P0001';
    end if;
    return new;
  end if;

  -- UPDATE
  if old.status = 'cancelled' then
    raise exception 'Cancelled consultations can''t be changed.'
      using errcode = 'P0001';
  end if;

  if new.scheduled_at is distinct from old.scheduled_at then
    if old.status <> 'booked' then
      raise exception 'Only booked consultations can be rescheduled.'
        using errcode = 'P0001';
    end if;
    if new.scheduled_at <= now() then
      raise exception 'Consultation must be in the future.'
        using errcode = 'P0001';
    end if;
  end if;

  if new.status is distinct from old.status then
    if not (
      (old.status = 'booked' and new.status in ('completed', 'cancelled'))
      or (old.status = 'completed' and new.status = 'booked')
    ) then
      if new.status = 'cancelled' then
        raise exception 'Only booked consultations can be cancelled.'
          using errcode = 'P0001';
      end if;
      raise exception 'That status change isn''t allowed.'
        using errcode = 'P0001';
    end if;
  end if;

  return new;
end;
$$;

comment on function public.enforce_consultation_rules() is
  'Rejects invalid consultation changes: past times, changes to cancelled consultations and status moves outside booked/completed/cancelled rules.';

-- Runs before consultations_set_updated_at (triggers fire in name order).
create trigger consultations_enforce_rules
  before insert or update on public.consultations
  for each row
  execute function public.enforce_consultation_rules();
