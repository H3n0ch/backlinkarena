-- Automatic tournament emails (lib/tournament-emails.ts).
--  * entries.knockout_emailed_at: set (claimed) when the "you're out + 30% off" email is handled.
--  * tournaments.results_emailed_at: set (claimed) when the results / winner emails are handled.
-- Both are claimed with "update ... where X is null" before sending, so parallel engine runs never double-send.

alter table entries add column if not exists knockout_emailed_at timestamptz;
alter table tournaments add column if not exists results_emailed_at timestamptz;

-- Tournaments that finished before this migration don't get a surprise results email.
-- (Knockout emails aren't backfilled: they're only sent while the participant offer is still valid.)
update tournaments set results_emailed_at = now()
where status = 'finished' and results_emailed_at is null;
