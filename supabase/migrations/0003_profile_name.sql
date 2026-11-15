-- Store the voter's name (from Google sign-in) next to the email. No profile picture.

alter table profiles add column if not exists full_name text;

-- New users: copy email + name.
create or replace function handle_new_user() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  insert into profiles (id, email, full_name)
  values (
    new.id,
    new.email,
    nullif(coalesce(new.raw_user_meta_data ->> 'full_name', new.raw_user_meta_data ->> 'name'), '')
  )
  on conflict (id) do update
    set email = excluded.email,
        full_name = coalesce(excluded.full_name, profiles.full_name);
  return new;
end $$;

-- Existing users who later sign in with Google (name arrives then): keep profile in sync.
create or replace function handle_user_updated() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  update profiles
    set email = new.email,
        full_name = coalesce(
          nullif(coalesce(new.raw_user_meta_data ->> 'full_name', new.raw_user_meta_data ->> 'name'), ''),
          full_name
        )
  where id = new.id;
  return new;
end $$;

drop trigger if exists on_auth_user_updated on auth.users;
create trigger on_auth_user_updated
  after update of email, raw_user_meta_data on auth.users
  for each row execute function handle_user_updated();

revoke execute on function handle_user_updated() from public, anon, authenticated;

-- Backfill.
update profiles p
  set full_name = nullif(coalesce(u.raw_user_meta_data ->> 'full_name', u.raw_user_meta_data ->> 'name'), '')
from auth.users u
where u.id = p.id and p.full_name is null;
