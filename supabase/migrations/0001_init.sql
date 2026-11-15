-- Backlink Arena v1 schema
-- Run once in the Supabase SQL editor (or `supabase db push`).

create extension if not exists pgcrypto;

-- ---------------------------------------------------------------------------
-- Tables
-- ---------------------------------------------------------------------------

create table profiles (
  id uuid primary key references auth.users on delete cascade,
  email text,
  is_admin boolean not null default false,
  created_at timestamptz not null default now()
);

create table products (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references profiles on delete cascade,
  url text not null,
  domain text not null unique,
  slug text not null unique,
  name text not null check (char_length(name) between 1 and 80),
  description text check (char_length(description) <= 300),
  logo_url text check (char_length(logo_url) <= 1000),
  category text check (char_length(category) <= 60),
  badge_status text not null default 'none' check (badge_status in ('none','pending','verified')),
  pass_paid boolean not null default false,
  created_at timestamptz not null default now()
);
create index products_owner_idx on products (owner_id);

create table tournaments (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  status text not null default 'draft' check (status in ('draft','qualifying','bracket','finished')),
  bracket_size int not null default 8 check (bracket_size in (8, 16)),
  qualifying_ends_at timestamptz,
  match_hours int not null default 48 check (match_hours between 1 and 720),
  winner_product_id uuid references products,
  prize_url text,
  prize_delivered_at timestamptz,
  created_at timestamptz not null default now()
);
-- One tournament at a time.
create unique index tournaments_one_active on tournaments ((true)) where status <> 'finished';

create table entries (
  id uuid primary key default gen_random_uuid(),
  tournament_id uuid not null references tournaments on delete cascade,
  product_id uuid not null references products on delete cascade,
  entry_path text not null check (entry_path in ('free','badge','pass')),
  qualified boolean not null default false,
  eliminated_round int,
  created_at timestamptz not null default now(),
  unique (tournament_id, product_id)
);
create index entries_product_idx on entries (product_id);

create table qualifying_votes (
  tournament_id uuid not null references tournaments on delete cascade,
  product_id uuid not null references products on delete cascade,
  voter_id uuid not null references profiles on delete cascade,
  created_at timestamptz not null default now(),
  primary key (tournament_id, product_id, voter_id)
);
create index qualifying_votes_voter_idx on qualifying_votes (voter_id, created_at);

create table matches (
  id uuid primary key default gen_random_uuid(),
  tournament_id uuid not null references tournaments on delete cascade,
  round int not null,
  position int not null,
  product_a uuid references products,
  product_b uuid references products,
  starts_at timestamptz not null,
  ends_at timestamptz not null,
  winner_product_id uuid references products,
  status text not null default 'open' check (status in ('open','closed')),
  unique (tournament_id, round, position)
);
create index matches_open_idx on matches (status, ends_at);

create table votes (
  match_id uuid not null references matches on delete cascade,
  voter_id uuid not null references profiles on delete cascade,
  product_id uuid not null references products,
  ref text check (char_length(ref) <= 64),
  created_at timestamptz not null default now(),
  primary key (match_id, voter_id)
);
create index votes_voter_idx on votes (voter_id, created_at);
create index votes_match_product_idx on votes (match_id, product_id, created_at);

create table waitlist (
  email text primary key check (email ~* '^[^@\s]+@[^@\s]+\.[^@\s]+$'),
  website text check (char_length(website) <= 300),
  created_at timestamptz not null default now()
);

-- ---------------------------------------------------------------------------
-- Helpers
-- ---------------------------------------------------------------------------

create or replace function is_admin() returns boolean
language sql stable security definer set search_path = public as $$
  select coalesce((select is_admin from profiles where id = auth.uid()), false);
$$;

-- True when the request comes from an API user (anon / authenticated JWT),
-- false for service_role and direct SQL (no JWT). Reads the JWT claim rather
-- than current_user, because current_user is the owner inside security definer.
create or replace function is_api_user() returns boolean
language sql stable as $$
  select coalesce(
    nullif(current_setting('request.jwt.claims', true), '')::jsonb ->> 'role',
    ''
  ) in ('anon', 'authenticated');
$$;

-- Profile row for every new auth user.
create or replace function handle_new_user() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  insert into profiles (id, email) values (new.id, new.email)
  on conflict (id) do update set email = excluded.email;
  return new;
end $$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function handle_new_user();

-- ---------------------------------------------------------------------------
-- Integrity triggers
-- ---------------------------------------------------------------------------

create or replace function check_rate_limit(p_voter uuid) returns void
language plpgsql security definer set search_path = public as $$
declare n int;
begin
  select (select count(*) from votes where voter_id = p_voter and created_at > now() - interval '1 hour')
       + (select count(*) from qualifying_votes where voter_id = p_voter and created_at > now() - interval '1 hour')
    into n;
  if n >= 30 then
    raise exception 'RATE_LIMIT' using errcode = 'P0001';
  end if;
end $$;

create or replace function votes_before_insert() returns trigger
language plpgsql security definer set search_path = public as $$
declare m matches;
begin
  new.created_at := now();
  if is_api_user() then
    new.voter_id := auth.uid();
  end if;
  if new.voter_id is null then
    raise exception 'NOT_LOGGED_IN' using errcode = 'P0001';
  end if;

  select * into m from matches where id = new.match_id;
  if not found or m.status <> 'open' or now() < m.starts_at or now() >= m.ends_at then
    raise exception 'MATCH_CLOSED' using errcode = 'P0001';
  end if;
  if new.product_id is distinct from m.product_a and new.product_id is distinct from m.product_b then
    raise exception 'NOT_IN_MATCH' using errcode = 'P0001';
  end if;
  if exists (
    select 1 from products
    where id in (m.product_a, m.product_b) and owner_id = new.voter_id
  ) then
    raise exception 'OWN_MATCH' using errcode = 'P0001';
  end if;

  perform check_rate_limit(new.voter_id);
  return new;
end $$;

create trigger votes_before_insert
  before insert on votes
  for each row execute function votes_before_insert();

create or replace function qualifying_votes_before_insert() returns trigger
language plpgsql security definer set search_path = public as $$
declare t tournaments;
begin
  new.created_at := now();
  if is_api_user() then
    new.voter_id := auth.uid();
  end if;
  if new.voter_id is null then
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
  if exists (select 1 from products where id = new.product_id and owner_id = new.voter_id) then
    raise exception 'OWN_PRODUCT' using errcode = 'P0001';
  end if;

  perform check_rate_limit(new.voter_id);
  return new;
end $$;

create trigger qualifying_votes_before_insert
  before insert on qualifying_votes
  for each row execute function qualifying_votes_before_insert();

-- Owners may edit name/description/logo/category and request a badge check,
-- nothing else. Admins / service role may change anything.
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
    new.created_at := now();
    return new;
  end if;
  if new.owner_id <> old.owner_id or new.domain <> old.domain or new.slug <> old.slug
     or new.url <> old.url or new.pass_paid <> old.pass_paid or new.created_at <> old.created_at then
    raise exception 'FORBIDDEN_FIELD' using errcode = 'P0001';
  end if;
  if new.badge_status <> old.badge_status
     and not (old.badge_status = 'none' and new.badge_status = 'pending') then
    raise exception 'FORBIDDEN_FIELD' using errcode = 'P0001';
  end if;
  return new;
end $$;

create trigger products_guard
  before insert or update on products
  for each row execute function products_guard();

-- Self-service entries are always free, unqualified, into a draft/qualifying tournament.
create or replace function entries_guard() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if not is_api_user() or is_admin() then
    return new;
  end if;
  new.entry_path := 'free';
  new.qualified := false;
  new.eliminated_round := null;
  new.created_at := now();
  if not exists (
    select 1 from tournaments where id = new.tournament_id and status in ('draft','qualifying')
  ) then
    raise exception 'TOURNAMENT_CLOSED' using errcode = 'P0001';
  end if;
  return new;
end $$;

create trigger entries_guard
  before insert on entries
  for each row execute function entries_guard();

-- ---------------------------------------------------------------------------
-- RLS
-- ---------------------------------------------------------------------------

alter table profiles enable row level security;
alter table products enable row level security;
alter table tournaments enable row level security;
alter table entries enable row level security;
alter table qualifying_votes enable row level security;
alter table matches enable row level security;
alter table votes enable row level security;
alter table waitlist enable row level security;

create policy "own profile or admin" on profiles for select
  using (id = auth.uid() or is_admin());

create policy "public read" on products for select using (true);
create policy "owner insert" on products for insert to authenticated
  with check (owner_id = auth.uid());
create policy "owner update" on products for update to authenticated
  using (owner_id = auth.uid() or is_admin())
  with check (owner_id = auth.uid() or is_admin());
create policy "admin delete" on products for delete to authenticated
  using (is_admin());

create policy "public read" on tournaments for select using (true);
create policy "admin write" on tournaments for all to authenticated
  using (is_admin()) with check (is_admin());

create policy "public read" on entries for select using (true);
create policy "owner insert free entry" on entries for insert to authenticated
  with check (
    exists (select 1 from products p where p.id = product_id and p.owner_id = auth.uid())
    or is_admin()
  );
create policy "admin update" on entries for update to authenticated
  using (is_admin()) with check (is_admin());
create policy "admin delete" on entries for delete to authenticated
  using (is_admin());

create policy "public read" on matches for select using (true);
create policy "admin write" on matches for all to authenticated
  using (is_admin()) with check (is_admin());

-- Votes: users see and insert only their own. No update/delete policies.
create policy "own votes" on votes for select to authenticated
  using (voter_id = auth.uid());
create policy "insert own vote" on votes for insert to authenticated
  with check (voter_id = auth.uid());

create policy "own qualifying votes" on qualifying_votes for select to authenticated
  using (voter_id = auth.uid());
create policy "insert own qualifying vote" on qualifying_votes for insert to authenticated
  with check (voter_id = auth.uid());

create policy "anyone can join waitlist" on waitlist for insert to anon, authenticated
  with check (true);

-- ---------------------------------------------------------------------------
-- Public read RPCs (no voter IDs leave the database)
-- ---------------------------------------------------------------------------

create or replace function match_counts(p_match_id uuid)
returns table (a_votes int, b_votes int)
language sql stable security definer set search_path = public as $$
  select
    (select count(*)::int from votes v where v.match_id = m.id and v.product_id = m.product_a),
    (select count(*)::int from votes v where v.match_id = m.id and v.product_id = m.product_b)
  from matches m where m.id = p_match_id;
$$;

create or replace function tournament_match_counts(p_tournament_id uuid)
returns table (match_id uuid, a_votes int, b_votes int)
language sql stable security definer set search_path = public as $$
  select m.id,
    (select count(*)::int from votes v where v.match_id = m.id and v.product_id = m.product_a),
    (select count(*)::int from votes v where v.match_id = m.id and v.product_id = m.product_b)
  from matches m where m.tournament_id = p_tournament_id;
$$;

create or replace function qualifying_leaderboard(p_tournament_id uuid)
returns table (product_id uuid, entry_path text, votes int, entry_created_at timestamptz)
language sql stable security definer set search_path = public as $$
  select e.product_id, e.entry_path,
    (select count(*)::int from qualifying_votes q
      where q.tournament_id = e.tournament_id and q.product_id = e.product_id) as votes,
    e.created_at
  from entries e
  where e.tournament_id = p_tournament_id
  order by votes desc, e.created_at asc;
$$;

-- Open, live matches the current user can still vote in.
create or replace function my_unvoted_open_matches()
returns setof uuid
language sql stable security definer set search_path = public as $$
  select m.id from matches m
  where m.status = 'open' and now() >= m.starts_at and now() < m.ends_at
    and not exists (select 1 from votes v where v.match_id = m.id and v.voter_id = auth.uid())
    and not exists (
      select 1 from products p
      where p.id in (m.product_a, m.product_b) and p.owner_id = auth.uid()
    )
  order by m.round, m.position;
$$;

-- Public totals for the homepage social-proof strip.
create or replace function arena_stats()
returns table (sites int, votes int, backlinks_won int)
language sql stable security definer set search_path = public as $$
  select
    (select count(*)::int from products),
    ((select count(*) from votes) + (select count(*) from qualifying_votes))::int,
    (select count(*)::int from tournaments where status = 'finished' and winner_product_id is not null);
$$;

-- ---------------------------------------------------------------------------
-- Tournament engine (scheduled job). Idempotent: safe to run any number of times.
-- ---------------------------------------------------------------------------

-- Seeds the bracket and creates round 1. Returns false if there are too few entries.
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
             else -(select count(*) from qualifying_votes q
                    where q.tournament_id = e.tournament_id and q.product_id = e.product_id)
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

-- Closes ended matches with the tie rule.
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
    elsif a_cnt > 0 and a_last <> b_last then
      -- Tie: the product whose most recent vote is older wins.
      w := case when a_last < b_last then m.product_a else m.product_b end;
    else
      -- Zero votes (or identical timestamps): earlier signup wins.
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

-- Creates the next round when the current one is fully closed, or finishes the tournament.
create or replace function advance_rounds(p_tournament_id uuid) returns void
language plpgsql security definer set search_path = public as $$
declare
  t tournaments;
  r int;
  cnt int;
  i int;
  wa uuid; wb uuid;
begin
  select * into t from tournaments where id = p_tournament_id;
  select max(round) into r from matches where tournament_id = p_tournament_id;
  if r is null then return; end if;
  if exists (select 1 from matches where tournament_id = p_tournament_id and round = r and status = 'open') then
    return;
  end if;

  select count(*) into cnt from matches where tournament_id = p_tournament_id and round = r;
  if cnt = 1 then
    update tournaments
      set winner_product_id = (select winner_product_id from matches
                               where tournament_id = p_tournament_id and round = r),
          status = 'finished'
    where id = p_tournament_id and status = 'bracket';
    return;
  end if;

  for i in 1 .. cnt / 2 loop
    select winner_product_id into wa from matches where tournament_id = p_tournament_id and round = r and position = 2*i - 1;
    select winner_product_id into wb from matches where tournament_id = p_tournament_id and round = r and position = 2*i;
    insert into matches (tournament_id, round, position, product_a, product_b, starts_at, ends_at)
    values (p_tournament_id, r + 1, i, wa, wb, now(), now() + make_interval(hours => t.match_hours))
    on conflict do nothing;
  end loop;
end $$;

-- Entry point for the scheduled job and the admin "start bracket now" button.
-- p_force_bracket: tournament id to seed now even if qualifying hasn't ended.
create or replace function advance_tournaments(p_force_bracket uuid default null) returns jsonb
language plpgsql security definer set search_path = public as $$
declare
  t tournaments;
  seeded boolean;
  closed int := 0;
  result jsonb := '[]'::jsonb;
begin
  for t in
    select * from tournaments where status in ('qualifying','bracket') for update
  loop
    seeded := null;
    if t.status = 'qualifying'
       and (t.id = p_force_bracket or (t.qualifying_ends_at is not null and t.qualifying_ends_at <= now())) then
      seeded := seed_bracket(t.id);
    end if;

    if (select status from tournaments where id = t.id) = 'bracket' then
      closed := close_due_matches(t.id);
      perform advance_rounds(t.id);
    end if;

    result := result || jsonb_build_object(
      'tournament', t.id,
      'seeded', seeded,
      'closed_matches', closed,
      'status', (select status from tournaments where id = t.id)
    );
  end loop;
  return result;
end $$;

-- ---------------------------------------------------------------------------
-- Function privileges
-- ---------------------------------------------------------------------------

revoke execute on function seed_bracket(uuid), close_due_matches(uuid), advance_rounds(uuid),
  advance_tournaments(uuid), check_rate_limit(uuid), handle_new_user()
  from public, anon, authenticated;
grant execute on function advance_tournaments(uuid) to service_role;

grant execute on function match_counts(uuid), tournament_match_counts(uuid),
  qualifying_leaderboard(uuid) to anon, authenticated;
grant execute on function my_unvoted_open_matches() to authenticated;
grant execute on function arena_stats() to anon, authenticated;
