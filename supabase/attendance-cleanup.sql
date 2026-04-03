begin;

create table if not exists public.attendance_backup_before_cleanup as
select *
from public.attendance;

do $$
declare
  has_current_schema boolean;
  has_legacy_schema boolean;
begin
  select exists (
    select 1
    from information_schema.columns
    where table_schema = 'public'
      and table_name = 'attendance'
      and column_name = 'date'
  )
  into has_current_schema;

  select exists (
    select 1
    from information_schema.columns
    where table_schema = 'public'
      and table_name = 'attendance'
      and column_name = 'login_time'
  )
  into has_legacy_schema;

  if has_current_schema then
    with ranked as (
      select
        id,
        user_id,
        date,
        check_in,
        check_out,
        created_at,
        row_number() over (
          partition by user_id, date
          order by created_at asc, id asc
        ) as row_num
      from public.attendance
    ),
    grouped as (
      select
        user_id,
        date,
        (array_agg(id order by row_num asc, created_at asc, id asc))[1] as keep_id,
        min(check_in) as merged_check_in,
        case
          when bool_or(check_out is null) then null
          else max(check_out)
        end as merged_check_out,
        count(*) as row_count
      from ranked
      group by user_id, date
      having count(*) > 1
    )
    update public.attendance as attendance_row
    set
      check_in = grouped.merged_check_in,
      check_out = grouped.merged_check_out,
      status = case
        when grouped.merged_check_in is null or grouped.merged_check_out is null then 'Pending'
        when extract(epoch from (grouped.merged_check_out - grouped.merged_check_in)) / 60 < 180 then 'Absent'
        when extract(epoch from (grouped.merged_check_out - grouped.merged_check_in)) / 60 < 300 then 'Half Day'
        else 'Full Day'
      end
    from grouped
    where attendance_row.id = grouped.keep_id;

    with ranked as (
      select
        id,
        user_id,
        date,
        created_at,
        row_number() over (
          partition by user_id, date
          order by created_at asc, id asc
        ) as row_num
      from public.attendance
    )
    delete from public.attendance as attendance_row
    using ranked
    where attendance_row.id = ranked.id
      and ranked.row_num > 1;

    execute 'create unique index if not exists attendance_user_id_date_key on public.attendance (user_id, date)';
  elsif has_legacy_schema then
    alter table public.attendance
      add column if not exists work_date date;

    update public.attendance
    set work_date = date(timezone('utc', login_time))
    where login_time is not null
      and work_date is distinct from date(timezone('utc', login_time));

    with ranked as (
      select
        id,
        user_id,
        login_time,
        logout_time,
        duration_minutes,
        shift_minutes,
        created_at,
        work_date,
        row_number() over (
          partition by user_id, work_date
          order by created_at asc, id asc
        ) as row_num
      from public.attendance
    ),
    grouped as (
      select
        user_id,
        work_date,
        (array_agg(id order by row_num asc, created_at asc, id asc))[1] as keep_id,
        min(login_time) as merged_login_time,
        case
          when bool_or(logout_time is null) then null
          else max(logout_time)
        end as merged_logout_time,
        sum(
          case
            when duration_minutes is not null then greatest(duration_minutes, 0)
            when login_time is not null and logout_time is not null then greatest(round(extract(epoch from (logout_time - login_time)) / 60), 0)
            else 0
          end
        )::integer as merged_duration_minutes,
        max(shift_minutes) as merged_shift_minutes,
        bool_or(logout_time is null) as has_open_shift,
        count(*) as row_count
      from ranked
      group by user_id, work_date
      having count(*) > 1
    )
    update public.attendance as attendance_row
    set
      login_time = grouped.merged_login_time,
      logout_time = grouped.merged_logout_time,
      duration_minutes = grouped.merged_duration_minutes,
      shift_minutes = coalesce(grouped.merged_shift_minutes, attendance_row.shift_minutes),
      attendance_status = case
        when grouped.has_open_shift then 'Pending'
        when grouped.merged_duration_minutes < 180 then 'Absent'
        when grouped.merged_duration_minutes < 300 then 'Half Day'
        else 'Full Day'
      end
    from grouped
    where attendance_row.id = grouped.keep_id;

    with ranked as (
      select
        id,
        user_id,
        work_date,
        created_at,
        row_number() over (
          partition by user_id, work_date
          order by created_at asc, id asc
        ) as row_num
      from public.attendance
    )
    delete from public.attendance as attendance_row
    using ranked
    where attendance_row.id = ranked.id
      and ranked.row_num > 1;

    execute 'create unique index if not exists attendance_user_id_work_date_key on public.attendance (user_id, work_date)';
  end if;
end $$;

commit;
