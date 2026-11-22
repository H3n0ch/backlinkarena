-- 0019: the badge path also needs two social posts about Backlink Arena.
-- Safe to run more than once. Run AFTER 0001–0018.
--
--  * badge_posts  links to the owner's two posts (any platform), saved with the badge check

alter table products add column if not exists badge_posts text[] not null default '{}';

-- Owners may not set it themselves; only the server (service role) does.
create or replace function products_guard() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if not is_api_user() or is_admin() then
    return new;
  end if;
  if tg_op = 'INSERT' then
    new.owner_id := auth.uid();
    new.badge_status := 'none';
    new.pass_paid := false;
    new.pass_paid_at := null;
    new.badge_page := null;
    new.badge_requested_at := null;
    new.badge_posts := '{}';
    new.created_at := now();
    return new;
  end if;
  if new.owner_id <> old.owner_id or new.domain <> old.domain or new.slug <> old.slug
     or new.url <> old.url or new.pass_paid <> old.pass_paid or new.created_at <> old.created_at
     or new.pass_paid_at is distinct from old.pass_paid_at
     or new.badge_page is distinct from old.badge_page
     or new.badge_requested_at is distinct from old.badge_requested_at
     or new.badge_posts is distinct from old.badge_posts then
    raise exception 'FORBIDDEN_FIELD' using errcode = 'P0001';
  end if;
  if new.badge_status <> old.badge_status
     and not (old.badge_status = 'none' and new.badge_status = 'pending') then
    raise exception 'FORBIDDEN_FIELD' using errcode = 'P0001';
  end if;
  return new;
end $$;

notify pgrst, 'reload schema';
