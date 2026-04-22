begin;

insert into public.role_permissions (role, module, can_view, can_create, can_update, can_delete, can_approve, data_scope)
values
  ('manager', 'kudos', true, true, false, false, false, 'organization'),
  ('hr', 'leave', true, true, true, false, true, 'organization'),
  ('admin', 'kudos', true, true, false, false, false, 'all')
on conflict (role, module) do update
set
  can_view = excluded.can_view,
  can_create = excluded.can_create,
  can_update = excluded.can_update,
  can_delete = excluded.can_delete,
  can_approve = excluded.can_approve,
  data_scope = excluded.data_scope;

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
    return actor_role = 'admin';
  end if;

  return false;
end;
$$;

commit;
