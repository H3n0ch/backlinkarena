-- 0009: admin control room. Manual seats, pause/resume, disqualification.
-- Safe to run more than once. Run AFTER 0001–0008.
--
--  * entries.seat (1..bracket_size): the admin places brands into bracket seats one by one.
--    Round 1 pairs seat 1 v 2, 3 v 4, ... When the bracket starts, placed brands keep their
--    seat; empty seats are filled in ranking order (pass/badge first, then most votes).
--  * tournaments.paused_at: while set, no votes are accepted and the engine skips the
--    tournament. Resuming (from the app) pushes the timers back by the paused time.
--  * entries.disqualified_at: a disqualified brand is out. It never counts for seeding,
--    can't receive qualifying votes and is hidden from the public leaderboard.

alter table entries add column if not exists seat int check (seat between 1 and 64);
alter table entries add column if not exists disqualified_at timestamptz;
alter table entries add column if not exists dq_reason text check (char_length(dq_reason) <= 300);
create unique index if not exists entries_seat_unique on entries (tournament_id, seat) where seat is not null;

alter table tournaments add column if not exists paused_at timestamptz;

-- ---------------------------------------------------------------------------
-- Public leaderboard: no disqualified brands
-- ---------------------------------------------------------------------------

create or replace function qualifying_leaderboard(p_tournament_id uuid)
returns table (product_id uuid, entry_path text, votes int, entry_created_at timestamptz)
language sql stable security definer set search_path = public as $$
  select e.product_id, e.entry_path,
    greatest(0, (select count(*)::int from qualifying_votes q
      where q.tournament_id = e.tournament_id and q.product_id = e.product_id) + e.vote_adjust) as votes,
    e.created_at
  from entries e
  where e.tournament_id = p_tournament_id and e.disqualified_at is null
  order by votes desc, e.created_at asc;
$$;

-- ---------------------------------------------------------------------------
-- Seeding: manual seats first, then the ranking fills the empty seats
-- ---------------------------------------------------------------------------

create or replace function seed_bracket(p_tournament_id uuid) returns boolean
language plpgsql security definer set search_path = public as $$
declare
  t tournaments;
  n_total int;
  size int;
  seats uuid[];
  ranked uuid[];
  pid uuid;
  i int;
  j int := 1;
begin
  select * into t from tournaments where id = p_tournament_id;
  if t.status <> 'qualifying' then
    return false;
  end if;

  size := t.bracket_size;
  select count(*) into n_total from entries
  where tournament_id = p_tournament_id and disqualified_at is null;
  if n_total < size then
    return false;
  end if;

  -- Seats placed by the admin.
  seats := array_fill(null::uuid, array[size]);
  for pid, i in
    select product_id, seat from entries
    where tournament_id = p_tournament_id and disqualified_at is null and seat between 1 and size
  loop
    seats[i] := pid;
  end loop;

  -- Everyone else in ranking order: badge + pass first (by signup), then votes desc, earlier signup.
  select array_agg(product_id order by grp, k1, k2) into ranked from (
    select e.product_id,
      case when e.entry_path in ('badge','pass') then 0 else 1 end as grp,
      case when e.entry_path in ('badge','pass') then 0
           else -greatest(0, (select count(*) from qualifying_votes q
                  where q.tournament_id = e.tournament_id and q.product_id = e.product_id) + e.vote_adjust)
      end as k1,
      e.created_at as k2
    from entries e
    where e.tournament_id = p_tournament_id and e.disqualified_at is null
      and (e.seat is null or e.seat > size)
  ) r;

  -- Fill empty seats in seat order.
  for i in 1 .. size loop
    if seats[i] is null then
      seats[i] := ranked[j];
      j := j + 1;
    end if;
  end loop;

  update entries set qualified = (product_id = any(seats)),
                     eliminated_round = case when product_id = any(seats) then null else 0 end,
                     seat = case when product_id = any(seats) then array_position(seats, product_id) else null end
  where tournament_id = p_tournament_id;

  -- A Contender Pass is good for one tournament: used up once the brand gets a bracket spot.
  update products set pass_paid = false
  where id in (
    select product_id from entries
    where tournament_id = p_tournament_id and entry_path = 'pass' and qualified
  );

  for i in 1 .. size / 2 loop
    insert into matches (tournament_id, round, position, product_a, product_b, starts_at, ends_at)
    values (p_tournament_id, 1, i, seats[2*i - 1], seats[2*i], now(),
            now() + make_interval(hours => t.match_hours))
    on conflict do nothing;
  end loop;

  update tournaments set status = 'bracket', qualifying_overtime = false where id = p_tournament_id;
  return true;
end $$;

-- ---------------------------------------------------------------------------
-- Engine: skip paused tournaments, ignore disqualified entries
-- ---------------------------------------------------------------------------

create or replace function advance_tournaments(p_force_bracket uuid default null) returns jsonb
language plpgsql security definer set search_path = public as $$
declare
  t tournaments;
  seeded boolean;
  closed int := 0;
  n_entries int;
  result jsonb := '[]'::jsonb;
begin
  for t in
    select * from tournaments
    where status in ('qualifying','bracket') and paused_at is null
    for update
  loop
    seeded := null;
    closed := 0;
    if t.status = 'qualifying' then
      select count(*) into n_entries from entries where tournament_id = t.id and disqualified_at is null;
      if t.id = p_force_bracket
         or (t.qualifying_ends_at is not null and t.qualifying_ends_at <= now())
         or (t.qualifying_overtime and n_entries >= t.bracket_size) then
        seeded := seed_bracket(t.id);
        if not seeded and t.id is distinct from p_force_bracket then
          update tournaments
          set qualifying_overtime = true,
              qualifying_ends_at = greatest(coalesce(qualifying_ends_at, now()), now()) + interval '24 hours'
          where id = t.id;
        end if;
      end if;
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
-- Votes: nothing while paused, no qualifying votes for disqualified brands
-- ---------------------------------------------------------------------------

create or replace function votes_before_insert() returns trigger
language plpgsql security definer set search_path = public as $$
declare m matches;
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

  select * into m from matches where id = new.match_id;
  if not found or m.status <> 'open' or now() < m.starts_at or now() >= m.ends_at then
    raise exception 'MATCH_CLOSED' using errcode = 'P0001';
  end if;
  if exists (select 1 from tournaments where id = m.tournament_id and paused_at is not null) then
    raise exception 'TOURNAMENT_PAUSED' using errcode = 'P0001';
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
  if t.paused_at is not null then
    raise exception 'TOURNAMENT_PAUSED' using errcode = 'P0001';
  end if;
  if not exists (
    select 1 from entries
    where tournament_id = new.tournament_id and product_id = new.product_id
      and entry_path = 'free' and disqualified_at is null
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

-- Self-service entries can't pick a seat or undo a disqualification.
create or replace function entries_guard() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if not is_api_user() or is_admin() then
    return new;
  end if;
  if tg_op = 'UPDATE' and old.disqualified_at is not null then
    raise exception 'FORBIDDEN_FIELD' using errcode = 'P0001';
  end if;
  new.entry_path := 'free';
  new.qualified := false;
  new.eliminated_round := null;
  new.vote_adjust := 0;
  new.seat := null;
  new.disqualified_at := null;
  new.dq_reason := null;
  new.created_at := now();
  if not exists (
    select 1 from tournaments where id = new.tournament_id and status in ('draft','qualifying')
  ) then
    raise exception 'TOURNAMENT_CLOSED' using errcode = 'P0001';
  end if;
  return new;
end $$;

revoke execute on function seed_bracket(uuid), advance_tournaments(uuid) from public, anon, authenticated;
grant execute on function advance_tournaments(uuid) to service_role;
grant execute on function qualifying_leaderboard(uuid) to anon, authenticated;

notify pgrst, 'reload schema';
