begin;

alter table public.leaves
  add column if not exists deleted_at timestamptz;

alter table public.leaves
  add column if not exists deleted_by uuid references public.profiles(id) on delete set null;

create or replace function public.enforce_leave_status_change()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.status is distinct from old.status or new.approver_id is distinct from old.approver_id then
    if not public.has_module_permission('leave', 'approve') then
      raise exception 'Only authorized approvers can change leave status.';
    end if;

    if old.user_id = auth.uid() then
      raise exception 'You cannot approve or reject your own leave request.';
    end if;

    if not public.can_access_user(old.user_id, 'leave') then
      raise exception 'You cannot approve leave outside your scope.';
    end if;
  end if;

  if new.deleted_at is distinct from old.deleted_at or new.deleted_by is distinct from old.deleted_by then
    if public.current_app_role() <> 'admin' or not public.has_module_permission('leave', 'delete') then
      raise exception 'Only admins can delete leave requests.';
    end if;

    new.deleted_by := case when new.deleted_at is null then null else auth.uid() end;
  end if;

  return new;
end;
$$;

drop policy if exists "Leave rows can be deleted by admins" on public.leaves;

commit;
