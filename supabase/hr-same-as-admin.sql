-- ============================================================
-- Give the HR role the same access as admin.
-- Run once in the Supabase SQL editor (safe to re-run).
-- ============================================================
begin;

-- 1) Copy every admin permission row to hr (the app reads these rows over its built-in defaults).
insert into public.role_permissions (role, module, can_view, can_create, can_update, can_delete, can_approve, data_scope)
select 'hr', module, can_view, can_create, can_update, can_delete, can_approve, data_scope
from public.role_permissions
where role = 'admin'
on conflict (role, module) do update
set
  can_view = excluded.can_view,
  can_create = excluded.can_create,
  can_update = excluded.can_update,
  can_delete = excluded.can_delete,
  can_approve = excluded.can_approve,
  data_scope = excluded.data_scope;

-- 2) data_scope = 'all' was admin-only inside can_access_user; let hr through too.
create or replace function public.can_access_user(target_user_id uuid, module_name text)
returns boolean
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  data_scope text := public.module_data_scope(module_name);
  actor_role text := public.current_app_role();
begin
  if auth.uid() is null then
    return false;
  end if;

  if module_name = 'wall_of_fame' then
    return true;
  end if;

  if data_scope = 'own' then
    return target_user_id = auth.uid();
  end if;

  if data_scope = 'team' then
    return target_user_id = auth.uid() or public.manages_user(target_user_id);
  end if;

  if data_scope = 'organization' then
    if module_name = 'kudos' then
      return actor_role in ('manager', 'hr', 'admin');
    end if;

    return actor_role in ('hr', 'admin');
  end if;

  if data_scope = 'all' then
    return actor_role in ('hr', 'admin');
  end if;

  return false;
end;
$$;

-- 3) Leave status / delete trigger: allow hr to delete leave requests as well.
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
    if public.current_app_role() not in ('admin', 'hr') or not public.has_module_permission('leave', 'delete') then
      raise exception 'Only admins and HR can delete leave requests.';
    end if;

    new.deleted_by := case when new.deleted_at is null then null else auth.uid() end;
  end if;

  return new;
end;
$$;

-- 4) Access-grants and role-permission lists were readable by admin only.
drop policy if exists "Users can read their role permissions" on public.role_permissions;
create policy "Users can read their role permissions"
on public.role_permissions
for select
using (
  role = public.current_app_role()
  or public.current_app_role() in ('admin', 'hr')
);

drop policy if exists "Admins can read access grants" on public.access_grants;
create policy "Admins can read access grants"
on public.access_grants
for select
using (public.current_app_role() in ('admin', 'hr'));

commit;
