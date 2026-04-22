begin;

alter table public.attendance
  add column if not exists is_paused boolean not null default false;

alter table public.attendance
  add column if not exists pause_start_time timestamptz;

alter table public.attendance
  add column if not exists total_paused_duration integer not null default 0;

update public.attendance
set
  is_paused = coalesce(is_paused, false),
  total_paused_duration = coalesce(total_paused_duration, 0)
where is_paused is null
   or total_paused_duration is null;

commit;
