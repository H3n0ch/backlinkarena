-- 0016: paid passes get bracket spots in the order they were paid.
-- Safe to run more than once. Run AFTER 0001–0015.
--
--  * products.pass_paid_at  when the current pass was paid. Set automatically when pass_paid
--    turns on (if empty); kept when a pass is used or restored after a stopped tournament.
--  * Ranking for empty seats: paid pass (earliest payment first), then badge (earliest entry
--    first), then free entries by votes (earlier entry breaks ties).

alter table products add column if not exists pass_paid_at timestamptz;

-- Backfill: latest non-refunded payment, else when the product was created.
update products p
set pass_paid_at = coalesce(
  (select max(pay.created_at) from payments pay where pay.product_id = p.id and pay.refunded_at is null),
  p.created_at)
where p.pass_paid and p.pass_paid_at is null;

create or replace function products_pass_paid_at() returns trigger
language plpgsql as $$
begin
  if new.pass_paid and new.pass_paid_at is null then
    new.pass_paid_at := now();
  end if;
  return new;
end $$;

drop trigger if exists products_pass_paid_at on products;
create trigger products_pass_paid_at
  before insert or update of pass_paid, pass_paid_at on products
  for each row execute function products_pass_paid_at();

-- ---------------------------------------------------------------------------
-- Seeding (same as 0010, ranking now pass by payment time, then badge, then votes)
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

  -- Everyone else in ranking order: pass (who paid first), badge (earliest entry), then votes desc.
  select array_agg(product_id order by grp, k1, k2) into ranked from (
    select e.product_id,
      case e.entry_path when 'pass' then 0 when 'badge' then 1 else 2 end as grp,
      case when e.entry_path in ('badge','pass') then 0
           else -greatest(0, (select count(*) from qualifying_votes q
                  where q.tournament_id = e.tournament_id and q.product_id = e.product_id) + e.vote_adjust)
      end as k1,
      case when e.entry_path = 'pass' then coalesce(p.pass_paid_at, e.created_at) else e.created_at end as k2
    from entries e
    join products p on p.id = e.product_id
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

notify pgrst, 'reload schema';
