create table if not exists public.buyer_billing_subscriptions (
  id bigint generated always as identity primary key,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  provider text not null default 'zoho_billing',
  buyer_id bigint not null references public.buyers(id) on delete cascade,
  puppy_id bigint null references public.puppies(id) on delete set null,
  reference_id text not null,
  customer_id text null,
  customer_email text null,
  customer_name text null,
  subscription_id text null,
  subscription_status text null,
  hostedpage_id text null,
  hostedpage_url text null,
  hostedpage_expires_at timestamptz null,
  plan_code text null,
  plan_name text null,
  recurring_price numeric(10, 2) null,
  currency_code text not null default 'USD',
  interval_count integer null,
  interval_unit text null,
  billing_cycles integer null,
  current_term_ends_at date null,
  next_billing_at date null,
  started_at date null,
  last_payment_at date null,
  last_payment_amount numeric(10, 2) null,
  card_last_four text null,
  card_expiry_month integer null,
  card_expiry_year integer null,
  last_event_id text null,
  last_event_type text null,
  last_event_at timestamptz null,
  raw_subscription jsonb not null default '{}'::jsonb,
  raw_hostedpage jsonb not null default '{}'::jsonb
);

create unique index if not exists buyer_billing_subscriptions_buyer_puppy_provider_uidx
  on public.buyer_billing_subscriptions (buyer_id, puppy_id, provider);

create unique index if not exists buyer_billing_subscriptions_subscription_uidx
  on public.buyer_billing_subscriptions (subscription_id)
  where subscription_id is not null;

create index if not exists buyer_billing_subscriptions_customer_idx
  on public.buyer_billing_subscriptions (customer_id)
  where customer_id is not null;

create index if not exists buyer_billing_subscriptions_status_idx
  on public.buyer_billing_subscriptions (subscription_status, updated_at desc);

create index if not exists buyer_billing_subscriptions_next_billing_idx
  on public.buyer_billing_subscriptions (next_billing_at asc nulls last);

create or replace function public.set_buyer_billing_subscriptions_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists trg_buyer_billing_subscriptions_updated_at on public.buyer_billing_subscriptions;

create trigger trg_buyer_billing_subscriptions_updated_at
before update on public.buyer_billing_subscriptions
for each row
execute function public.set_buyer_billing_subscriptions_updated_at();

alter table public.buyer_billing_subscriptions enable row level security;

grant select on public.buyer_billing_subscriptions to authenticated;

create policy "buyer_billing_subscriptions_select_own_account"
  on public.buyer_billing_subscriptions
  for select
  to authenticated
  using (
    exists (
      select 1
      from public.buyers
      where buyers.id = buyer_billing_subscriptions.buyer_id
        and (
          buyers.user_id = auth.uid()
          or lower(coalesce(buyers.email, '')) = lower(coalesce(auth.jwt() ->> 'email', ''))
        )
    )
  );
