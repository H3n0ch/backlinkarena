-- Admin CRM: manual vote adjustments, homepage stat offsets, logo uploads.
-- Safe to run more than once. Run AFTER 0001–0004.
--
-- Vote counts are still computed from real vote rows. An admin can add a signed
-- adjustment on top (per match side, and per qualifying entry). Every public count
-- and the tournament engine use real + adjustment, never below zero.

-- ---------------------------------------------------------------------------
-- Columns / tables
-- ---------------------------------------------------------------------------

alter table matches add column if not exists a_adjust int not null default 0;
alter table matches add column if not exists b_adjust int not null default 0;
alter table entries add column if not exists vote_adjust int not null default 0;

-- One-row table: offsets added to the homepage stats strip.
create table if not exists site_settings (
  id boolean primary key default true check (id),
  sites_offset int not null default 0,
  votes_offset int not null default 0,
  backlinks_offset int not null default 0,
  updated_at timestamptz not null default now()
);
insert into site_settings (id) values (true) on conflict do nothing;
alter table site_settings enable row level security;
-- No policies: only the service role (admin server actions) and security-definer functions read it.

-- Public bucket for logos uploaded from the admin panel (uploads use the service role).
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('logos', 'logos', true, 2097152,
        array['image/png','image/jpeg','image/webp','image/gif','image/svg+xml','image/x-icon','image/vnd.microsoft.icon'])
on conflict (id) do nothing;

-- ---------------------------------------------------------------------------
-- Self-service entries can never carry a vote adjustment.
-- ---------------------------------------------------------------------------

create or replace function entries_guard() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if not is_api_user() or is_admin() then
    return new;
  end if;
  new.entry_path := 'free';
  new.qualified := false;
  new.eliminated_round := null;
  new.vote_adjust := 0;
  new.created_at := now();
  if not exists (
    select 1 from tournaments where id = new.tournament_id and status in ('draft','qualifying')
  ) then
    raise exception 'TOURNAMENT_CLOSED' using errcode = 'P0001';
  end if;
  return new;
end $$;

-- ---------------------------------------------------------------------------
-- Public counts (real + adjustment)
-- ---------------------------------------------------------------------------

create or replace function match_counts(p_match_id uuid)
returns table (a_votes int, b_votes int)
language sql stable security definer set search_path = public as $$
  select
    greatest(0, (select count(*)::int from votes v where v.match_id = m.id and v.product_id = m.product_a) + m.a_adjust),
    greatest(0, (select count(*)::int from votes v where v.match_id = m.id and v.product_id = m.product_b) + m.b_adjust)
  from matches m where m.id = p_match_id;
$$;

create or replace function tournament_match_counts(p_tournament_id uuid)
returns table (match_id uuid, a_votes int, b_votes int)
language sql stable security definer set search_path = public as $$
  select m.id,
    greatest(0, (select count(*)::int from votes v where v.match_id = m.id and v.product_id = m.product_a) + m.a_adjust),
    greatest(0, (select count(*)::int from votes v where v.match_id = m.id and v.product_id = m.product_b) + m.b_adjust)
  from matches m where m.tournament_id = p_tournament_id;
$$;

create or replace function qualifying_leaderboard(p_tournament_id uuid)
returns table (product_id uuid, entry_path text, votes int, entry_created_at timestamptz)
language sql stable security definer set search_path = public as $$
  select e.product_id, e.entry_path,
    greatest(0, (select count(*)::int from qualifying_votes q
      where q.tournament_id = e.tournament_id and q.product_id = e.product_id) + e.vote_adjust) as votes,
    e.created_at
  from entries e
  where e.tournament_id = p_tournament_id
  order by votes desc, e.created_at asc;
$$;

create or replace function arena_stats()
returns table (sites int, votes int, backlinks_won int)
language sql stable security definer set search_path = public as $$
  select
    greatest(0, (select count(*)::int from products)
      + coalesce((select sites_offset from site_settings), 0)),
    greatest(0, ((select count(*) from votes) + (select count(*) from qualifying_votes))::int
      + coalesce((select sum(a_adjust + b_adjust)::int from matches), 0)
      + coalesce((select sum(vote_adjust)::int from entries), 0)
      + coalesce((select votes_offset from site_settings), 0)),
    greatest(0, (select count(*)::int from tournaments where status = 'finished' and winner_product_id is not null)
      + coalesce((select backlinks_offset from site_settings), 0));
$$;

-- ---------------------------------------------------------------------------
-- Engine: seeding and match closing use adjusted counts
-- ---------------------------------------------------------------------------

create or replace function seed_bracket(p_tournament_id uuid) returns boolean
language plpgsql security definer set search_path = public as $$
declare
  t tournaments;
  n_total int;
  size int;
  picked uuid[];
  i int;
begin
  select * into t from tournaments where id = p_tournament_id;
  if t.status <> 'qualifying' then
    return false;
  end if;

  select count(*) into n_total from entries where tournament_id = p_tournament_id;
  size := t.bracket_size;
  if n_total < size then
    size := 8;
  end if;
  if n_total < size then
    return false;
  end if;

  -- Badge + pass first (by signup), then qualifying leaderboard (votes desc, earlier signup).
  select array_agg(product_id order by grp, k1, k2) into picked from (
    select product_id, grp, k1, k2 from (
      select e.product_id,
        case when e.entry_path in ('badge','pass') then 0 else 1 end as grp,
        case when e.entry_path in ('badge','pass') then 0
             else -greatest(0, (select count(*) from qualifying_votes q
                    where q.tournament_id = e.tournament_id and q.product_id = e.product_id) + e.vote_adjust)
        end as k1,
        e.created_at as k2
      from entries e
      where e.tournament_id = p_tournament_id
    ) ranked
    order by grp, k1, k2
    limit size
  ) s;

  update entries set qualified = (product_id = any(picked)),
                     eliminated_round = case when product_id = any(picked) then null else 0 end
  where tournament_id = p_tournament_id;

  -- Random pairing for round 1.
  select array_agg(x order by random()) into picked from unnest(picked) x;
  for i in 1 .. size / 2 loop
    insert into matches (tournament_id, round, position, product_a, product_b, starts_at, ends_at)
    values (p_tournament_id, 1, i, picked[2*i - 1], picked[2*i], now(),
            now() + make_interval(hours => t.match_hours))
    on conflict do nothing;
  end loop;

  update tournaments set status = 'bracket', bracket_size = size where id = p_tournament_id;
  return true;
end $$;

create or replace function close_due_matches(p_tournament_id uuid) returns int
language plpgsql security definer set search_path = public as $$
declare
  m matches;
  a_cnt int; b_cnt int;
  a_last timestamptz; b_last timestamptz;
  a_signup timestamptz; b_signup timestamptz;
  w uuid; l uuid;
  n int := 0;
begin
  for m in
    select * from matches
    where tournament_id = p_tournament_id and status = 'open' and ends_at <= now()
    order by round, position
    for update
  loop
    select count(*), max(created_at) into a_cnt, a_last from votes where match_id = m.id and product_id = m.product_a;
    select count(*), max(created_at) into b_cnt, b_last from votes where match_id = m.id and product_id = m.product_b;
    a_cnt := greatest(0, a_cnt + m.a_adjust);
    b_cnt := greatest(0, b_cnt + m.b_adjust);
    select created_at into a_signup from entries where tournament_id = p_tournament_id and product_id = m.product_a;
    select created_at into b_signup from entries where tournament_id = p_tournament_id and product_id = m.product_b;

    if m.product_b is null then
      w := m.product_a;
    elsif m.product_a is null then
      w := m.product_b;
    elsif a_cnt > b_cnt then
      w := m.product_a;
    elsif b_cnt > a_cnt then
      w := m.product_b;
    elsif a_cnt > 0 and a_last is not null and b_last is not null and a_last <> b_last then
      -- Tie: the product whose most recent vote is older wins.
      w := case when a_last < b_last then m.product_a else m.product_b end;
    else
      -- Zero votes (or no comparable timestamps): earlier signup wins.
      w := case when a_signup <= b_signup then m.product_a else m.product_b end;
    end if;
    l := case when w = m.product_a then m.product_b else m.product_a end;

    update matches set winner_product_id = w, status = 'closed' where id = m.id;
    if l is not null then
      update entries set eliminated_round = m.round
      where tournament_id = p_tournament_id and product_id = l;
    end if;
    n := n + 1;
  end loop;
  return n;
end $$;

-- Re-assert privileges (create or replace keeps them, this is just belt and braces).
revoke execute on function seed_bracket(uuid), close_due_matches(uuid) from public, anon, authenticated;
grant execute on function match_counts(uuid), tournament_match_counts(uuid),
  qualifying_leaderboard(uuid), arena_stats() to anon, authenticated;

notify pgrst, 'reload schema';
