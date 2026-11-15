-- Integrity checks for voting rules. Runs inside a transaction and rolls back.
-- Paste into the Supabase SQL editor after running the migration.
-- Every check raises an exception on failure; success ends with 'ALL CHECKS PASSED'.

begin;

-- Fixtures ------------------------------------------------------------------
insert into auth.users (id, email, aud, role)
values ('00000000-0000-0000-0000-00000000000a', 'owner-a@test.local', 'authenticated', 'authenticated'),
       ('00000000-0000-0000-0000-00000000000b', 'owner-b@test.local', 'authenticated', 'authenticated'),
       ('00000000-0000-0000-0000-00000000000c', 'voter@test.local',   'authenticated', 'authenticated');

-- Make sure no other active tournament blocks the fixture (unique index).
update tournaments set status = 'finished' where status <> 'finished';

insert into products (id, owner_id, url, domain, slug, name) values
  ('10000000-0000-0000-0000-00000000000a', '00000000-0000-0000-0000-00000000000a', 'https://a.test', 'a.test', 'a-test', 'A'),
  ('10000000-0000-0000-0000-00000000000b', '00000000-0000-0000-0000-00000000000b', 'https://b.test', 'b.test', 'b-test', 'B');

insert into tournaments (id, name, status) values
  ('20000000-0000-0000-0000-000000000001', 'Test', 'bracket');

insert into entries (tournament_id, product_id, entry_path) values
  ('20000000-0000-0000-0000-000000000001', '10000000-0000-0000-0000-00000000000a', 'free'),
  ('20000000-0000-0000-0000-000000000001', '10000000-0000-0000-0000-00000000000b', 'free');

insert into matches (id, tournament_id, round, position, product_a, product_b, starts_at, ends_at) values
  ('30000000-0000-0000-0000-000000000001', '20000000-0000-0000-0000-000000000001', 1, 1,
   '10000000-0000-0000-0000-00000000000a', '10000000-0000-0000-0000-00000000000b', now() - interval '1 hour', now() + interval '1 hour'),
  ('30000000-0000-0000-0000-000000000002', '20000000-0000-0000-0000-000000000001', 1, 2,
   '10000000-0000-0000-0000-00000000000a', '10000000-0000-0000-0000-00000000000b', now() - interval '2 hour', now() - interval '1 hour');

-- Act as the voter, exactly like an API request ------------------------------
set local role authenticated;
select set_config('request.jwt.claims',
  '{"sub":"00000000-0000-0000-0000-00000000000c","role":"authenticated"}', true);

-- 1. First vote works.
insert into votes (match_id, voter_id, product_id)
values ('30000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-00000000000c', '10000000-0000-0000-0000-00000000000a');

-- 2. Second vote in the same match fails.
do $$ begin
  insert into votes (match_id, voter_id, product_id)
  values ('30000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-00000000000c', '10000000-0000-0000-0000-00000000000b');
  raise exception 'FAIL: double vote accepted';
exception when unique_violation then null; end $$;

-- 3. Voting in an ended match fails.
do $$ begin
  insert into votes (match_id, voter_id, product_id)
  values ('30000000-0000-0000-0000-000000000002', '00000000-0000-0000-0000-00000000000c', '10000000-0000-0000-0000-00000000000a');
  raise exception 'FAIL: vote after ends_at accepted';
exception when raise_exception then
  if sqlerrm like 'FAIL%' then raise; end if;
end $$;

-- 4. Spoofing another voter_id fails (RLS with check).
do $$ begin
  insert into votes (match_id, voter_id, product_id)
  values ('30000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-00000000000b', '10000000-0000-0000-0000-00000000000a');
  raise exception 'FAIL: spoofed voter accepted';
exception when insufficient_privilege or unique_violation then null; end $$;

-- 5. Voters cannot delete or update votes (no policies => 0 rows affected).
do $$ declare n int; begin
  delete from votes where voter_id = '00000000-0000-0000-0000-00000000000c';
  get diagnostics n = row_count;
  if n <> 0 then raise exception 'FAIL: vote deleted by voter'; end if;
end $$;

-- 6. Voter cannot see other people's votes.
do $$ begin
  if (select count(*) from votes where voter_id <> '00000000-0000-0000-0000-00000000000c') > 0 then
    raise exception 'FAIL: foreign votes visible';
  end if;
end $$;

-- 7. Owner cannot vote in their own match.
select set_config('request.jwt.claims',
  '{"sub":"00000000-0000-0000-0000-00000000000a","role":"authenticated"}', true);
do $$ begin
  insert into votes (match_id, voter_id, product_id)
  values ('30000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-00000000000a', '10000000-0000-0000-0000-00000000000a');
  raise exception 'FAIL: own-match vote accepted';
exception when raise_exception then
  if sqlerrm <> 'OWN_MATCH' then raise; end if;
end $$;

-- 8. Owner cannot mark their own pass as paid or verify their badge.
do $$ begin
  update products set pass_paid = true where id = '10000000-0000-0000-0000-00000000000a';
  raise exception 'FAIL: owner set pass_paid';
exception when raise_exception then
  if sqlerrm <> 'FORBIDDEN_FIELD' then raise; end if;
end $$;
do $$ begin
  update products set badge_status = 'verified' where id = '10000000-0000-0000-0000-00000000000a';
  raise exception 'FAIL: owner verified badge';
exception when raise_exception then
  if sqlerrm <> 'FORBIDDEN_FIELD' then raise; end if;
end $$;

-- 9. Rate limit: 30 votes per hour across all votes.
reset role;
select set_config('request.jwt.claims', '', true);
do $$ declare i int; begin
  for i in 1..29 loop
    insert into products (id, owner_id, url, domain, slug, name)
    values (gen_random_uuid(), '00000000-0000-0000-0000-00000000000a', 'https://x' || i || '.test', 'x' || i || '.test', 'x' || i, 'X');
  end loop;
end $$;
-- 29 more match votes for voter c (already has 1), inserted as service role to build state quickly.
do $$ declare i int; pid uuid; mid uuid; begin
  for i in 1..29 loop
    select id into pid from products where domain = 'x' || i || '.test';
    mid := gen_random_uuid();
    insert into matches (id, tournament_id, round, position, product_a, product_b, starts_at, ends_at)
    values (mid, '20000000-0000-0000-0000-000000000001', 9, i, pid, '10000000-0000-0000-0000-00000000000b',
            now() - interval '1 minute', now() + interval '1 hour');
    insert into votes (match_id, voter_id, product_id) values (mid, '00000000-0000-0000-0000-00000000000c', pid);
  end loop;
end $$;
insert into matches (id, tournament_id, round, position, product_a, product_b, starts_at, ends_at)
values ('30000000-0000-0000-0000-000000000099', '20000000-0000-0000-0000-000000000001', 9, 99,
        '10000000-0000-0000-0000-00000000000a', '10000000-0000-0000-0000-00000000000b',
        now() - interval '1 minute', now() + interval '1 hour');
set local role authenticated;
select set_config('request.jwt.claims',
  '{"sub":"00000000-0000-0000-0000-00000000000c","role":"authenticated"}', true);
do $$ begin
  insert into votes (match_id, voter_id, product_id)
  values ('30000000-0000-0000-0000-000000000099', '00000000-0000-0000-0000-00000000000c', '10000000-0000-0000-0000-00000000000a');
  raise exception 'FAIL: 31st vote accepted';
exception when raise_exception then
  if sqlerrm <> 'RATE_LIMIT' then raise; end if;
end $$;

-- 10. Engine: closing an ended match picks a winner and is idempotent.
reset role;
select set_config('request.jwt.claims', '', true);
delete from matches where round = 9;
select advance_tournaments();
select advance_tournaments();
do $$ begin
  if (select status from matches where id = '30000000-0000-0000-0000-000000000002') <> 'closed' then
    raise exception 'FAIL: ended match not closed';
  end if;
  -- zero votes => earlier signup (A) wins
  if (select winner_product_id from matches where id = '30000000-0000-0000-0000-000000000002')
     <> '10000000-0000-0000-0000-00000000000a' then
    raise exception 'FAIL: zero-vote tie rule';
  end if;
end $$;

select 'ALL CHECKS PASSED' as result;
rollback;
