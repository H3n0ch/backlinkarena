-- 0011: track Stripe refunds so a refunded guaranteed spot is taken back exactly once.
-- Safe to run more than once. Run AFTER 0001–0010.

alter table payments add column if not exists refunded_at timestamptz;
create index if not exists payments_intent_idx on payments (stripe_payment_intent);

notify pgrst, 'reload schema';
