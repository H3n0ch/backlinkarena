-- Demo test run: Demo Brand A vs Demo Brand B in one live matchup.
-- Remove everything again with supabase/demo/remove_demo.sql.

begin;

insert into auth.users (id, email, aud, role, created_at, updated_at)
values
  ('d0000000-0000-0000-0000-00000000000a', 'demo-a@backlinkarena.test', 'authenticated', 'authenticated', now(), now()),
  ('d0000000-0000-0000-0000-00000000000b', 'demo-b@backlinkarena.test', 'authenticated', 'authenticated', now(), now())
on conflict (id) do nothing;

insert into products (id, owner_id, url, domain, slug, name, description, category)
values
  ('d1000000-0000-0000-0000-00000000000a', 'd0000000-0000-0000-0000-00000000000a',
   'https://example.com', 'demo-brand-a.test', 'demo-brand-a', 'Demo Brand A',
   'A demo brand for the Backlink Arena test run. Vote if A should get the backlink.', 'Demo'),
  ('d1000000-0000-0000-0000-00000000000b', 'd0000000-0000-0000-0000-00000000000b',
   'https://example.org', 'demo-brand-b.test', 'demo-brand-b', 'Demo Brand B',
   'A demo brand for the Backlink Arena test run. Vote if B should get the backlink.', 'Demo')
on conflict (id) do nothing;

insert into tournaments (id, name, status, bracket_size, match_hours)
values ('d2000000-0000-0000-0000-000000000001', 'Test Run', 'bracket', 16, 24)
on conflict (id) do nothing;

insert into entries (tournament_id, product_id, entry_path, qualified)
values
  ('d2000000-0000-0000-0000-000000000001', 'd1000000-0000-0000-0000-00000000000a', 'free', true),
  ('d2000000-0000-0000-0000-000000000001', 'd1000000-0000-0000-0000-00000000000b', 'free', true)
on conflict do nothing;

insert into matches (id, tournament_id, round, position, product_a, product_b, starts_at, ends_at)
values ('d3000000-0000-0000-0000-000000000001', 'd2000000-0000-0000-0000-000000000001', 1, 1,
        'd1000000-0000-0000-0000-00000000000a', 'd1000000-0000-0000-0000-00000000000b',
        now(), now() + interval '24 hours')
on conflict (id) do nothing;

commit;

select m.id as match_id, m.ends_at, t.name as tournament
from matches m join tournaments t on t.id = m.tournament_id
where m.id = 'd3000000-0000-0000-0000-000000000001';
