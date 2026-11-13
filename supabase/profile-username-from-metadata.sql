-- Fix profiles whose display name was derived from the email address
-- (e.g. "saibhavani.work" from saibhavani.work@gmail.com) instead of the
-- first/last name entered when the admin created the user.
-- Note: profiles has no username column; the entered username lives in
-- public.user_creation.

-- 1. Going forward: when a profile row is inserted for a new Auth user,
--    take the name from the invite metadata if present.
create or replace function public.apply_profile_metadata_names()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  meta jsonb;
  meta_name text;
begin
  select raw_user_meta_data
  into meta
  from auth.users
  where id = new.id;

  if meta is null then
    return new;
  end if;

  meta_name := nullif(
    trim(coalesce(
      meta ->> 'name',
      concat_ws(' ', meta ->> 'first_name', meta ->> 'last_name')
    )),
    ''
  );

  if meta_name is not null then
    new.name := meta_name;
  end if;

  return new;
end;
$$;

drop trigger if exists profiles_apply_metadata_names on public.profiles;
create trigger profiles_apply_metadata_names
before insert on public.profiles
for each row
execute function public.apply_profile_metadata_names();

-- 2. Repair existing users: copy the entered first/last name from
--    user_creation into profiles where it differs.
update public.profiles as p
set name = nullif(trim(concat_ws(' ', uc.first_name, uc.last_name)), '')
from public.user_creation as uc
where uc.user_id = p.id
  and nullif(trim(concat_ws(' ', uc.first_name, uc.last_name)), '') is not null
  and p.name is distinct from nullif(trim(concat_ws(' ', uc.first_name, uc.last_name)), '');

-- 3. Check the result.
select p.email, uc.username, p.name
from public.profiles as p
join public.user_creation as uc on uc.user_id = p.id
order by p.email;
