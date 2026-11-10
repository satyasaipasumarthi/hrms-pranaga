begin;

-- The `attendance` table previously had a trigger (`attendance_set_updated_at`)
-- that ran on every UPDATE and tried to set NEW.updated_at, but the table has
-- no `updated_at` column. This broke check-out, pause, and resume with:
--   record "new" has no field "updated_at"
-- The trigger was dropped manually in the Supabase SQL editor on 2026-09-18.
-- This migration keeps that fix idempotent and tracked in version control.

drop trigger if exists attendance_set_updated_at on public.attendance;

commit;
