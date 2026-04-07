create extension if not exists pgcrypto;

create table if not exists public.reporting_managers (
  id uuid primary key default gen_random_uuid(),
  name text not null unique,
  department text,
  profile_id uuid references public.profiles(id) on delete set null,
  is_active boolean not null default true,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now())
);

alter table public.profiles
  add column if not exists reporting_manager_id uuid references public.reporting_managers(id) on delete set null;

alter table public.access_grants
  add column if not exists reporting_manager_id uuid references public.reporting_managers(id) on delete set null;

create index if not exists profiles_reporting_manager_id_idx
on public.profiles (reporting_manager_id);

create index if not exists reporting_managers_profile_id_idx
on public.reporting_managers (profile_id);

create index if not exists access_grants_reporting_manager_id_idx
on public.access_grants (reporting_manager_id);

insert into public.reporting_managers (name, department, is_active)
values
  ('Raviteja', 'IT Department', true),
  ('Darshan', 'Operations', true),
  ('Sindhuja', 'Cyber Security', true),
  ('Sai Nithya', 'Leadership', true),
  ('Satya Sai', 'Leadership', true)
on conflict (name) do update
set
  department = excluded.department,
  is_active = excluded.is_active;

update public.reporting_managers as reporting_manager
set profile_id = profiles.id
from public.profiles as profiles
where reporting_manager.profile_id is null
  and lower(replace(reporting_manager.name, ' ', '')) = lower(replace(profiles.name, ' ', ''));

update public.profiles as profile
set reporting_manager_id = reporting_manager.id
from public.reporting_managers as reporting_manager
where profile.reporting_manager_id is null
  and reporting_manager.profile_id = profile.manager_id;

update public.access_grants as access_grant
set reporting_manager_id = reporting_manager.id
from public.reporting_managers as reporting_manager
where access_grant.reporting_manager_id is null
  and reporting_manager.profile_id = access_grant.manager_id;

alter table public.reporting_managers enable row level security;

drop policy if exists "Authenticated users can read reporting managers" on public.reporting_managers;
create policy "Authenticated users can read reporting managers"
on public.reporting_managers
for select
using (auth.uid() is not null);
