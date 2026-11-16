-- One-click voting without sign-in ("guest" votes).
-- Safe to run more than once. Run AFTER 0005.
--
-- A vote now belongs either to an account (voter_id) or to a browser (guest_id,
-- from an httpOnly cookie set by the server). Guest votes are only inserted by the
-- server with the service role, never directly through the API.
-- Limits for guests: one vote per browser per matchup, at most 3 guest votes per
-- network (hashed IP) per matchup, and 30 votes per network per hour.
-- All counting (public counts, engine, stats) keeps using count(*), so guest votes count.

do $$
begin
  -- votes: replace the (match_id, voter_id) primary key with a surrogate id
  if not exists (select 1 from information_schema.columns where table_name = 'votes' and column_name = 'id') then
    alter table votes drop constraint if exists votes_pkey;
    alter table votes add column id bigint generated always as identity primary key;
  end if;
  -- qualifying_votes: same
  if not exists (select 1 from information_schema.columns where table_name = 'qualifying_votes' and column_name = 'id') then
    alter table qualifying_votes drop constraint if exists qualifying_votes_pkey;
    alter table qualifying_votes add column id bigint generated always as identity primary key;
  end if;
end $$;

alter table votes add column if not exists guest_id uuid;
alter table votes add column if not exists ip_hash text check (char_length(ip_hash) <= 128);
alter table votes alter column voter_id drop not null;
alter table qualifying_votes add column if not exists guest_id uuid;
alter table qualifying_votes add column if not exists ip_hash text check (char_length(ip_hash) <= 128);
alter table qualifying_votes alter column voter_id drop not null;

do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'votes_has_voter') then
    alter table votes add constraint votes_has_voter check (voter_id is not null or guest_id is not null);
  end if;
  if not exists (select 1 from pg_constraint where conname = 'qualifying_votes_has_voter') then
    alter table qualifying_votes add constraint qualifying_votes_has_voter check (voter_id is not null or guest_id is not null);
  end if;
end $$;

-- One vote per account / per browser.
create unique index if not exists votes_one_per_account on votes (match_id, voter_id) where voter_id is not null;
create unique index if not exists votes_one_per_guest on votes (match_id, guest_id) where guest_id is not null;
create index if not exists votes_ip_idx on votes (ip_hash, created_at) where ip_hash is not null;
create unique index if not exists qvotes_one_per_account on qualifying_votes (tournament_id, product_id, voter_id) where voter_id is not null;
create unique index if not exists qvotes_one_per_guest on qualifying_votes (tournament_id, product_id, guest_id) where guest_id is not null;
create index if not exists qvotes_ip_idx on qualifying_votes (ip_hash, created_at) where ip_hash is not null;

-- ---------------------------------------------------------------------------
-- Guest limits
-- ---------------------------------------------------------------------------

create or replace function check_guest_limits(p_ip_hash text, p_match uuid, p_tournament uuid, p_product uuid)
returns void
language plpgsql security definer set search_path = public as $$
declare n int;
begin
  if p_ip_hash is null then
    return;
  end if;
  -- Same network, same matchup (or same qualifying product): max 3 browsers.
  if p_match is not null then
    select count(*) into n from votes where match_id = p_match and ip_hash = p_ip_hash and guest_id is not null;
  else
    select count(*) into n from qualifying_votes
      where tournament_id = p_tournament and product_id = p_product and ip_hash = p_ip_hash and guest_id is not null;
  end if;
  if n >= 3 then
    raise exception 'IP_LIMIT' using errcode = 'P0001';
  end if;
  -- Same network: max 30 votes per hour overall.
  select (select count(*) from votes where ip_hash = p_ip_hash and created_at > now() - interval '1 hour')
       + (select count(*) from qualifying_votes where ip_hash = p_ip_hash and created_at > now() - interval '1 hour')
    into n;
  if n >= 30 then
    raise exception 'RATE_LIMIT' using errcode = 'P0001';
  end if;
end $$;

-- ---------------------------------------------------------------------------
-- Insert triggers: accounts as before, guests via the server only
-- ---------------------------------------------------------------------------

create or replace function votes_before_insert() returns trigger
language plpgsql security definer set search_path = public as $$
declare m matches;
begin
  new.created_at := now();
  if is_api_user() then
    -- Direct API inserts are always the logged-in user; guests can't be faked.
    new.voter_id := auth.uid();
    new.guest_id := null;
    new.ip_hash := null;
  end if;
  if new.voter_id is null and new.guest_id is null then
    raise exception 'NOT_LOGGED_IN' using errcode = 'P0001';
  end if;

  select * into m from matches where id = new.match_id;
  if not found or m.status <> 'open' or now() < m.starts_at or now() >= m.ends_at then
    raise exception 'MATCH_CLOSED' using errcode = 'P0001';
  end if;
  if new.product_id is distinct from m.product_a and new.product_id is distinct from m.product_b then
    raise exception 'NOT_IN_MATCH' using errcode = 'P0001';
  end if;

  if new.voter_id is not null then
    if exists (
      select 1 from products
      where id in (m.product_a, m.product_b) and owner_id = new.voter_id
    ) then
      raise exception 'OWN_MATCH' using errcode = 'P0001';
    end if;
    perform check_rate_limit(new.voter_id);
  else
    perform check_guest_limits(new.ip_hash, new.match_id, null, null);
  end if;
  return new;
end $$;

create or replace function qualifying_votes_before_insert() returns trigger
language plpgsql security definer set search_path = public as $$
declare t tournaments;
begin
  new.created_at := now();
  if is_api_user() then
    new.voter_id := auth.uid();
    new.guest_id := null;
    new.ip_hash := null;
  end if;
  if new.voter_id is null and new.guest_id is null then
    raise exception 'NOT_LOGGED_IN' using errcode = 'P0001';
  end if;

  select * into t from tournaments where id = new.tournament_id;
  if not found or t.status <> 'qualifying'
     or (t.qualifying_ends_at is not null and now() >= t.qualifying_ends_at) then
    raise exception 'QUALIFYING_CLOSED' using errcode = 'P0001';
  end if;
  if not exists (
    select 1 from entries
    where tournament_id = new.tournament_id and product_id = new.product_id and entry_path = 'free'
  ) then
    raise exception 'NOT_IN_QUALIFYING' using errcode = 'P0001';
  end if;

  if new.voter_id is not null then
    if exists (select 1 from products where id = new.product_id and owner_id = new.voter_id) then
      raise exception 'OWN_PRODUCT' using errcode = 'P0001';
    end if;
    perform check_rate_limit(new.voter_id);
  else
    perform check_guest_limits(new.ip_hash, null, new.tournament_id, new.product_id);
  end if;
  return new;
end $$;

revoke execute on function check_guest_limits(text, uuid, uuid, uuid) from public, anon, authenticated;

notify pgrst, 'reload schema';
