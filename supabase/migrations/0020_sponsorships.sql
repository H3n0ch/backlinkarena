-- 0020: paid tournament sponsorships ($499, one sponsor per tournament).
-- Safe to run more than once. Run AFTER 0001–0019.
--
-- Flow (lib/payments.ts, app/actions/sponsor.ts):
--   pending_payment → checkout started on /sponsor, not paid yet
--   paid            → webhook confirmed the payment; waits for admin review
--   approved        → admin assigned it to a tournament: shown on /arena and its match pages
--   paused          → admin hid it for now (keeps its tournament slot)
--   rejected        → admin declined it (refund it in the payment dashboard)
--   refunded        → full refund confirmed by the webhook; never shown
-- Service role only (RLS on, no policies), like leads and payments.

create table if not exists sponsorships (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  status text not null default 'pending_payment'
    check (status in ('pending_payment', 'paid', 'approved', 'paused', 'rejected', 'refunded')),
  brand_name text not null check (char_length(brand_name) between 1 and 60),
  website text not null check (website ~* '^https?://' and char_length(website) <= 300),
  tagline text not null check (char_length(tagline) between 1 and 90),
  logo_url text check (logo_url ~* '^https?://' and char_length(logo_url) <= 500),
  email text not null check (email ~* '^[^@\s]+@[^@\s]+\.[^@\s]+$' and char_length(email) <= 200),
  tournament_id uuid references tournaments on delete set null,
  provider text,
  payment_ref text,
  amount_total int,
  currency text,
  paid_at timestamptz,
  approved_at timestamptz,
  clicks int not null default 0,
  ip_hash text check (char_length(ip_hash) <= 128)
);

create unique index if not exists sponsorships_payment_key on sponsorships (provider, payment_ref);
-- One sponsor slot per tournament.
create unique index if not exists sponsorships_one_per_tournament
  on sponsorships (tournament_id) where status in ('approved', 'paused');
create index if not exists sponsorships_created_idx on sponsorships (created_at desc);
create index if not exists sponsorships_ip_idx on sponsorships (ip_hash, created_at);
alter table sponsorships enable row level security;

create or replace function increment_sponsor_click(p_id uuid) returns void
language sql security definer set search_path = public as $$
  update sponsorships set clicks = clicks + 1 where id = p_id and status = 'approved';
$$;
revoke execute on function increment_sponsor_click(uuid) from public, anon, authenticated;
grant execute on function increment_sponsor_click(uuid) to service_role;

notify pgrst, 'reload schema';
