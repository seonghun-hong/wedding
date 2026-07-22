-- RSVP 답변을 같은 기기에서 안전하게 수정하기 위한 1회 실행 SQL입니다.
alter table public.rsvps
add column if not exists response_token uuid;

alter table public.rsvps
add column if not exists updated_at timestamp with time zone default now();

create unique index if not exists idx_rsvps_response_token
on public.rsvps (response_token)
where response_token is not null;

drop function if exists public.save_rsvp_response(
  uuid, text, text, text, integer, text, text, text
);

create or replace function public.save_rsvp_response(
  p_response_token uuid,
  p_name text,
  p_side text,
  p_attendance_status text,
  p_guest_count integer,
  p_meal text,
  p_shuttle_bus text,
  p_boarding_place text
)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
begin
  if p_response_token is null or length(trim(coalesce(p_name, ''))) = 0 then
    raise exception 'invalid RSVP response';
  end if;

  if p_attendance_status not in ('attending', 'declined') then
    raise exception 'invalid attendance status';
  end if;

  insert into public.rsvps (
    response_token,
    name,
    side,
    attendance_status,
    guest_count,
    meal,
    shuttle_bus,
    boarding_place,
    created_at,
    updated_at
  ) values (
    p_response_token,
    trim(p_name),
    nullif(p_side, ''),
    p_attendance_status,
    case when p_attendance_status = 'attending' then greatest(p_guest_count, 1) else 0 end,
    case when p_attendance_status = 'attending' then p_meal else 'no' end,
    case when p_attendance_status = 'attending' then p_shuttle_bus else 'no' end,
    case
      when p_attendance_status = 'attending' and p_shuttle_bus = 'yes'
      then nullif(p_boarding_place, '')
      else null
    end,
    now(),
    now()
  )
  on conflict (response_token) where response_token is not null do update set
    name = excluded.name,
    side = excluded.side,
    attendance_status = excluded.attendance_status,
    guest_count = excluded.guest_count,
    meal = excluded.meal,
    shuttle_bus = excluded.shuttle_bus,
    boarding_place = excluded.boarding_place,
    updated_at = now();

  return true;
end;
$$;

revoke all on function public.save_rsvp_response(uuid, text, text, text, integer, text, text, text) from public;
grant execute on function public.save_rsvp_response(uuid, text, text, text, integer, text, text, text) to anon;
grant execute on function public.save_rsvp_response(uuid, text, text, text, integer, text, text, text) to authenticated;
