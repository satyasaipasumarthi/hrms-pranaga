-- ============================================================
-- Team check-in / check-out feed for the notification bell.
-- Run once in the Supabase SQL editor (safe to re-run).
--
-- Why: employees can only read their OWN attendance rows (RLS), so the bell could not show
-- who else checked in or out. This security-definer function returns only the minimum
-- (name + check-in / check-out time) for the last N days, for any signed-in user.
--
-- To limit it to the caller's own department instead of everyone, add to the WHERE clause:
--   and p.department is not distinct from (select me.department from public.profiles me where me.id = auth.uid())
-- ============================================================

create or replace function public.team_attendance_feed(days_back integer default 7)
returns table (id uuid, user_id uuid, name text, check_in timestamptz, check_out timestamptz)
language plpgsql
security definer
set search_path = public
stable
as $$
begin
  if auth.uid() is null then
    return;
  end if;

  if exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'attendance' and column_name = 'check_in'
  ) then
    return query execute
      'select a.id, a.user_id, coalesce(p.name, p.email, ''Team member'')::text,
              a.check_in::timestamptz, a.check_out::timestamptz
       from public.attendance a
       left join public.profiles p on p.id = a.user_id
       where coalesce(a.check_in, a.check_out) >= now() - make_interval(days => $1)
         and coalesce(p.is_active, true)
       order by greatest(coalesce(a.check_in::timestamptz, ''-infinity''), coalesce(a.check_out::timestamptz, ''-infinity'')) desc
       limit 100'
    using days_back;
  elsif exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'attendance' and column_name = 'login_time'
  ) then
    return query execute
      'select a.id, a.user_id, coalesce(p.name, p.email, ''Team member'')::text,
              a.login_time::timestamptz, a.logout_time::timestamptz
       from public.attendance a
       left join public.profiles p on p.id = a.user_id
       where a.login_time >= now() - make_interval(days => $1)
         and coalesce(p.is_active, true)
       order by greatest(a.login_time::timestamptz, coalesce(a.logout_time::timestamptz, ''-infinity'')) desc
       limit 100'
    using days_back;
  end if;
end;
$$;

revoke all on function public.team_attendance_feed(integer) from public, anon;
grant execute on function public.team_attendance_feed(integer) to authenticated;

-- Check it (run while signed in via the app; in the SQL editor auth.uid() is null so it returns nothing):
-- select * from public.team_attendance_feed(7);
