-- Organization-wide headcount and today's attendance for the dashboard.
-- Employees cannot read other users' rows (RLS), so this security definer
-- function returns only the two numbers, never any personal data.

create or replace function public.dashboard_org_counts()
returns json
language plpgsql
security definer
set search_path = public
stable
as $$
declare
  -- Business day in India Standard Time (matches the app's UTC+5:30 logic).
  today date := (timezone('Asia/Kolkata', now()))::date;
  day_start timestamptz := (today::timestamp at time zone 'Asia/Kolkata');
  day_end timestamptz := ((today + 1)::timestamp at time zone 'Asia/Kolkata');
  total_count integer := 0;
  present_count integer := 0;
begin
  -- Employees in the organization: rows in the onboarding table
  -- (deleted employees are moved to employee_exit_records).
  select count(*)
  into total_count
  from public.employee_onboarding;

  -- Distinct users who logged in (checked in) today.
  if exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'attendance' and column_name = 'check_in'
  ) then
    execute
      'select count(distinct user_id) from public.attendance
       where date = $1 and check_in is not null'
    into present_count
    using today;
  elsif exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'attendance' and column_name = 'login_time'
  ) then
    execute
      'select count(distinct user_id) from public.attendance
       where login_time >= $1 and login_time < $2'
    into present_count
    using day_start, day_end;
  end if;

  return json_build_object(
    'total_employees', total_count,
    'present_today', present_count
  );
end;
$$;

revoke all on function public.dashboard_org_counts() from public;
grant execute on function public.dashboard_org_counts() to authenticated;

-- Check the numbers:
select public.dashboard_org_counts();
