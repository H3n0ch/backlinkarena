-- Exposure tracking + lead capture.
--
-- site_events: one "view" per visitor per matchup per day for both brands, and one
-- "click" per visitor per brand per day on "Visit site". Written and read only with
-- the service role (RLS on, no policies).
--
-- leads: enquiries from the "Talk to us" form and the participant offer (30% off).
-- Also service-role only.

create table if not exists site_events (
  id bigint generated always as identity primary key,
  product_id uuid not null references products on delete cascade,
  match_id uuid references matches on delete set null,
  kind text not null check (kind in ('view', 'click')),
  visitor text not null check (char_length(visitor) <= 64),
  day date not null default ((now() at time zone 'utc')::date),
  created_at timestamptz not null default now()
);
create unique index if not exists site_events_dedupe
  on site_events (product_id, kind, visitor, day, match_id) nulls not distinct;
create index if not exists site_events_product_idx on site_events (product_id, kind);
alter table site_events enable row level security;

create or replace function product_exposure(p_ids uuid[])
returns table (product_id uuid, views bigint, clicks bigint, votes bigint)
language sql stable security definer set search_path = public as $$
  select p.id,
    (select count(*) from site_events e where e.product_id = p.id and e.kind = 'view'),
    (select count(*) from site_events e where e.product_id = p.id and e.kind = 'click'),
    (select count(*) from votes v where v.product_id = p.id)
      + (select count(*) from qualifying_votes q where q.product_id = p.id)
  from unnest(p_ids) as p(id);
$$;
revoke execute on function product_exposure(uuid[]) from public, anon, authenticated;
grant execute on function product_exposure(uuid[]) to service_role;

create table if not exists leads (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  source text not null check (source in ('services', 'participant_offer')),
  service text not null check (char_length(service) <= 80),
  tier text check (char_length(tier) <= 80),
  name text check (char_length(name) <= 120),
  email text not null check (email ~* '^[^@\s]+@[^@\s]+\.[^@\s]+$' and char_length(email) <= 200),
  website text check (char_length(website) <= 300),
  message text check (char_length(message) <= 2000),
  discount numeric not null default 0 check (discount >= 0 and discount < 1),
  user_id uuid references profiles on delete set null,
  product_id uuid references products on delete set null,
  ip_hash text check (char_length(ip_hash) <= 128),
  status text not null default 'new' check (status in ('new', 'contacted', 'won', 'lost')),
  notes text check (char_length(notes) <= 4000)
);
create index if not exists leads_created_idx on leads (created_at desc);
create index if not exists leads_ip_idx on leads (ip_hash, created_at);
alter table leads enable row level security;
