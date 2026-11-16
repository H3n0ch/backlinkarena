-- 0007: brackets start only when full, single-use Contender Pass, waiting queue, Stripe payments.
-- Safe to run more than once. Run AFTER 0001–0006.
--
-- Rules after this migration:
--  * A bracket is seeded only when the tournament has at least `bracket_size` entries.
--    If qualifying ends before that, the tournament goes into "overtime": qualifying stays
--    open (rolling 24h timer) and the bracket starts on the first engine run once it is full.
--  * A Contender Pass (products.pass_paid) is good for ONE tournament: it is used up when the
--    brand is placed in a bracket. A pass that didn't get a spot (more guaranteed brands than
--    spots) carries over to the next tournament.
--  * Creating a tournament automatically enters every brand with an unused pass or a
--    verified badge ("the waiting queue").

-- ---------------------------------------------------------------------------
-- Columns / tables
-- ---------------------------------------------------------------------------

alter table tournaments add column if not exists qualifying_overtime boolean not null default false;

create table if not exists payments (
  id uuid primary key default gen_random_uuid(),
  product_id uuid references products on delete set null,
  user_id uuid,
  email text,
  stripe_session_id text not null unique,
  stripe_payment_intent text,
  amount_total int,
  currency text,
  created_at timestamptz not null default now()
);
create index if not exists payments_product_idx on payments (product_id);
alter table payments enable row level security;
-- No policies: only the service role (webhook + admin) reads and writes payments.

-- ---------------------------------------------------------------------------
-- Waiting queue: pass / badge brands go into every new tournament automatically
-- ---------------------------------------------------------------------------

create or replace function enter_waiting_products(p_tournament_id uuid) returns int
language plpgsql security definer set search_path = public as $$
declare n int;
begin
  insert into entries (tournament_id, product_id, entry_path)
  select p_tournament_id, p.id, case when p.pass_paid then 'pass' else 'badge' end
  from products p
  where p.pass_paid or p.badge_status = 'verified'
  on conflict (tournament_id, product_id) do update set entry_path = excluded.entry_path
    where entries.entry_path = 'free';
  get diagnostics n = row_count;
  return n;
end $$;

create or replace function tournaments_after_insert() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if new.status in ('draft', 'qualifying') then
    perform enter_waiting_products(new.id);
  end if;
  return null;
end $$;

drop trigger if exists tournaments_after_insert on tournaments;
create trigger tournaments_after_insert
  after insert on tournaments
  for each row execute function tournaments_after_insert();

-- ---------------------------------------------------------------------------
-- Seeding: only a full bracket, and passes are used up
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

  size := t.bracket_size;
  select count(*) into n_total from entries where tournament_id = p_tournament_id;
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

  -- A Contender Pass is good for one tournament: used up once the brand gets a bracket spot.
  update products set pass_paid = false
  where id in (
    select product_id from entries
    where tournament_id = p_tournament_id and entry_path = 'pass' and qualified
  );

  -- Random pairing for round 1.
  select array_agg(x order by random()) into picked from unnest(picked) x;
  for i in 1 .. size / 2 loop
    insert into matches (tournament_id, round, position, product_a, product_b, starts_at, ends_at)
    values (p_tournament_id, 1, i, picked[2*i - 1], picked[2*i], now(),
            now() + make_interval(hours => t.match_hours))
    on conflict do nothing;
  end loop;

  update tournaments set status = 'bracket', qualifying_overtime = false where id = p_tournament_id;
  return true;
end $$;

-- ---------------------------------------------------------------------------
-- Engine: overtime instead of starting a half-empty bracket
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
    select * from tournaments where status in ('qualifying','bracket') for update
  loop
    seeded := null;
    closed := 0;
    if t.status = 'qualifying' then
      select count(*) into n_entries from entries where tournament_id = t.id;
      if t.id = p_force_bracket
         or (t.qualifying_ends_at is not null and t.qualifying_ends_at <= now())
         or (t.qualifying_overtime and n_entries >= t.bracket_size) then
        seeded := seed_bracket(t.id);
        -- Time is up but the bracket isn't full: keep qualifying open, check again every run.
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
-- Privileges
-- ---------------------------------------------------------------------------

revoke execute on function enter_waiting_products(uuid), tournaments_after_insert(), seed_bracket(uuid),
  advance_tournaments(uuid) from public, anon, authenticated;
grant execute on function enter_waiting_products(uuid), advance_tournaments(uuid) to service_role;

notify pgrst, 'reload schema';
