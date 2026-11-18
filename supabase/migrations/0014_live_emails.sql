-- Emails during a tournament (lib/tournament-emails.ts):
--  * "Your match is live"        key live:<match_id>:<product_id>
--  * "You're behind, X left"     key behind:<match_id>:<product_id>
--  * "Qualifying ends in 24h"    key qualifying:<tournament_id>:<product_id>
-- A row is inserted (claimed) before the email is sent; the primary key makes sure that
-- parallel runs (cron, clock route, admin buttons) never send the same email twice.
-- Server only: RLS on, no policies, so only the service-role key can read or write it.

create table if not exists email_log (
  key text primary key check (char_length(key) <= 200),
  sent_at timestamptz not null default now()
);

alter table email_log enable row level security;
revoke all on email_log from anon, authenticated;
