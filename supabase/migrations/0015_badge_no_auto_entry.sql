-- 0015: only unused Contender Passes are entered automatically into a new tournament.
-- Verified-badge brands are no longer auto-entered; they enter themselves from the dashboard
-- and still skip qualifying when they do. Safe to run more than once.

create or replace function enter_waiting_products(p_tournament_id uuid) returns int
language plpgsql security definer set search_path = public as $$
declare n int;
begin
  insert into entries (tournament_id, product_id, entry_path)
  select p_tournament_id, p.id, 'pass'
  from products p
  where p.pass_paid
  on conflict (tournament_id, product_id) do update set entry_path = excluded.entry_path
    where entries.entry_path in ('free', 'badge');
  get diagnostics n = row_count;
  return n;
end $$;
