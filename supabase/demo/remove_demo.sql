-- Removes the demo test run (tournament, matches, votes, entries, brands, demo users).
begin;
delete from tournaments where id = 'd2000000-0000-0000-0000-000000000001';
delete from votes where product_id in ('d1000000-0000-0000-0000-00000000000a', 'd1000000-0000-0000-0000-00000000000b');
delete from products where id in ('d1000000-0000-0000-0000-00000000000a', 'd1000000-0000-0000-0000-00000000000b');
delete from auth.users where id in ('d0000000-0000-0000-0000-00000000000a', 'd0000000-0000-0000-0000-00000000000b');
commit;
