create table if not exists public.buyer_fee_credit_records (
  id bigint generated always as identity primary key,
  created_at timestamptz not null default now(),
  buyer_id bigint not null references public.buyers(id) on delete cascade,
  puppy_id bigint references public.puppies(id) on delete set null,
  created_by uuid references auth.users(id) on delete set null,
  entry_date date not null default current_date,
  entry_type text not null check (entry_type in ('fee', 'credit', 'transportation')),
  label text not null,
  description text,
  amount numeric(10, 2) not null check (amount >= 0),
  status text not null default 'recorded' check (status in ('recorded', 'pending', 'void', 'cancelled')),
  reference_number text
);

create index if not exists buyer_fee_credit_records_buyer_id_idx
  on public.buyer_fee_credit_records (buyer_id);

create index if not exists buyer_fee_credit_records_entry_date_idx
  on public.buyer_fee_credit_records (entry_date desc, created_at desc);

create index if not exists buyer_fee_credit_records_entry_type_idx
  on public.buyer_fee_credit_records (entry_type);

alter table public.buyer_fee_credit_records enable row level security;

grant select on public.buyer_fee_credit_records to authenticated;

create policy "buyer_fee_credit_records_select_own_account"
  on public.buyer_fee_credit_records
  for select
  to authenticated
  using (
    exists (
      select 1
      from public.buyers
      where buyers.id = buyer_fee_credit_records.buyer_id
        and (
          buyers.user_id = auth.uid()
          or lower(coalesce(buyers.email, '')) = lower(coalesce(auth.jwt() ->> 'email', ''))
        )
    )
  );
