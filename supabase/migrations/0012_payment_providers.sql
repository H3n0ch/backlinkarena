-- 0012: payments from more than one provider (Dodo Payments now, Stripe kept for later).
-- Safe to run more than once. Run AFTER 0001–0011.
--
--  * provider     'dodo' | 'stripe'
--  * external_id  unique per purchase (Dodo payment id, Stripe Checkout Session id)
--  * payment_ref  what refunds point at (Dodo payment id, Stripe PaymentIntent id)

alter table payments add column if not exists provider text not null default 'stripe';

do $$ begin
  if exists (select 1 from information_schema.columns
             where table_schema = 'public' and table_name = 'payments' and column_name = 'stripe_session_id') then
    alter table payments rename column stripe_session_id to external_id;
  end if;
  if exists (select 1 from information_schema.columns
             where table_schema = 'public' and table_name = 'payments' and column_name = 'stripe_payment_intent') then
    alter table payments rename column stripe_payment_intent to payment_ref;
  end if;
end $$;

-- New rows default to Dodo, the active provider. Existing rows (if any) stay 'stripe'.
alter table payments alter column provider set default 'dodo';

-- One purchase per provider id, instead of the old Stripe-only unique column.
alter table payments drop constraint if exists payments_stripe_session_id_key;
alter table payments drop constraint if exists payments_provider_external_id_key;
alter table payments add constraint payments_provider_external_id_key unique (provider, external_id);

drop index if exists payments_intent_idx;
create index if not exists payments_ref_idx on payments (provider, payment_ref);

notify pgrst, 'reload schema';
