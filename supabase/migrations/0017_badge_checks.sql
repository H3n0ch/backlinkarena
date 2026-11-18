-- 0017: what the admin needs to check a badge by hand.
-- Safe to run more than once. Run AFTER 0001–0016.
--
--  * badge_page          the page the owner said the badge is on (last check)
--  * badge_requested_at  when the badge went to "pending" (manual check queue, oldest first)

alter table products add column if not exists badge_page text;
alter table products add column if not exists badge_requested_at timestamptz;

-- Owners may not set these themselves; only the server (service role) does.
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
    new.created_at := now();
    return new;
  end if;
  if new.owner_id <> old.owner_id or new.domain <> old.domain or new.slug <> old.slug
     or new.url <> old.url or new.pass_paid <> old.pass_paid or new.created_at <> old.created_at
     or new.pass_paid_at is distinct from old.pass_paid_at
     or new.badge_page is distinct from old.badge_page
     or new.badge_requested_at is distinct from old.badge_requested_at then
    raise exception 'FORBIDDEN_FIELD' using errcode = 'P0001';
  end if;
  if new.badge_status <> old.badge_status
     and not (old.badge_status = 'none' and new.badge_status = 'pending') then
    raise exception 'FORBIDDEN_FIELD' using errcode = 'P0001';
  end if;
  return new;
end $$;

notify pgrst, 'reload schema';
