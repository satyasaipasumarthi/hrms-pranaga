create table if not exists public.employee_exit_records (
  like public.employee_onboarding including all
);

alter table public.employee_exit_records
  add column if not exists removed_at timestamptz not null default timezone('utc', now()),
  add column if not exists removed_by uuid references public.profiles(id) on delete set null,
  add column if not exists removed_by_name text,
  add column if not exists education_documents jsonb not null default '[]'::jsonb,
  add column if not exists previous_employment jsonb not null default '[]'::jsonb;

alter table public.employee_exit_records enable row level security;

drop policy if exists "Removed employees viewable by admin and HR"
  on public.employee_exit_records;
create policy "Removed employees viewable by admin and HR"
on public.employee_exit_records
for select
using (public.current_app_role() in ('admin', 'hr'));

grant select on public.employee_exit_records to authenticated;

create or replace function public.delete_onboarding_employee(p_employee_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  caller public.profiles%rowtype;
  target public.employee_onboarding%rowtype;
  archived_education_documents jsonb;
  archived_previous_employment jsonb;
begin
  select *
  into caller
  from public.profiles
  where id = auth.uid()
    and is_active = true;

  if not found or lower(caller.role) not in ('admin', 'hr') then
    raise exception 'Only administrators or HR can delete employees.';
  end if;

  select *
  into target
  from public.employee_onboarding
  where id = p_employee_id
  for update;

  if not found then
    raise exception 'Employee record not found.';
  end if;

  select coalesce(jsonb_agg(to_jsonb(document_row)), '[]'::jsonb)
  into archived_education_documents
  from public.employee_education_documents as document_row
  where document_row.employee_onboarding_id = target.id;

  select coalesce(jsonb_agg(to_jsonb(employment_row)), '[]'::jsonb)
  into archived_previous_employment
  from public.employee_previous_employment as employment_row
  where employment_row.employee_onboarding_id = target.id;

  insert into public.employee_exit_records
  select
    target.*,
    timezone('utc', now()),
    caller.id,
    caller.name,
    archived_education_documents,
    archived_previous_employment;

  delete from public.employee_onboarding
  where id = target.id;
end;
$$;

revoke all on function public.delete_onboarding_employee(uuid) from public;
grant execute on function public.delete_onboarding_employee(uuid) to authenticated;
