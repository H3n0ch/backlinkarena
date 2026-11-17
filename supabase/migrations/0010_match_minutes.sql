-- 0010: match length in minutes (so admins can test with 1-minute matches).
-- Safe to run more than once. Run AFTER 0001–0009.
--
--  * tournaments.match_minutes: length of each bracket match. Replaces match_hours in the
--    engine. match_hours stays (rounded up) so older code and reports keep working.

alter table tournaments add column if not exists match_minutes int;
update tournaments set match_minutes = match_hours * 60 where match_minutes is null;
alter table tournaments alter column match_minutes set default 2880;
alter table tournaments alter column match_minutes set not null;
do $$ begin
  alter table tournaments add constraint tournaments_match_minutes_check
    check (match_minutes between 1 and 43200);
exception when duplicate_object then null;
end $$;

-- ---------------------------------------------------------------------------
-- Seeding (same as 0009, match length now in minutes)
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
            now() + make_interval(mins => t.match_minutes))
    on conflict do nothing;
  end loop;

  update tournaments set status = 'bracket', qualifying_overtime = false where id = p_tournament_id;
  return true;
end $$;

-- ---------------------------------------------------------------------------
-- Next round (same as 0002, match length now in minutes)
-- ---------------------------------------------------------------------------

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
    values (p_tournament_id, r + 1, i, wa, wb, now(), now() + make_interval(mins => t.match_minutes))
    on conflict do nothing;
  end loop;
end $$;
