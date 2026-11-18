-- 0018: the footer "Contact" form saves its messages as leads with source 'contact'.
-- Safe to run more than once. Run AFTER 0001–0017.

alter table leads drop constraint if exists leads_source_check;
alter table leads add constraint leads_source_check
  check (source in ('services', 'participant_offer', 'contact'));

notify pgrst, 'reload schema';
