create table if not exists public.buyer_payment_notice_settings (
  id bigint generated always as identity primary key,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  buyer_id bigint not null references public.buyers (id) on delete cascade,
  enabled boolean not null default true,
  receipt_enabled boolean not null default true,
  due_reminder_enabled boolean not null default true,
  due_reminder_days_before integer not null default 5,
  late_notice_enabled boolean not null default true,
  late_notice_days_after integer not null default 3,
  default_notice_enabled boolean not null default true,
  default_notice_days_after integer not null default 14,
  recipient_email text null,
  cc_emails text[] not null default '{}'::text[],
  internal_note text null
);

create unique index if not exists buyer_payment_notice_settings_buyer_uidx
  on public.buyer_payment_notice_settings (buyer_id);

create index if not exists buyer_payment_notice_settings_enabled_idx
  on public.buyer_payment_notice_settings (enabled, updated_at desc);

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'buyer_payment_notice_settings_due_days_chk'
  ) then
    alter table public.buyer_payment_notice_settings
      add constraint buyer_payment_notice_settings_due_days_chk
      check (due_reminder_days_before between 0 and 30);
  end if;

  if not exists (
    select 1
    from pg_constraint
    where conname = 'buyer_payment_notice_settings_late_days_chk'
  ) then
    alter table public.buyer_payment_notice_settings
      add constraint buyer_payment_notice_settings_late_days_chk
      check (late_notice_days_after between 1 and 60);
  end if;

  if not exists (
    select 1
    from pg_constraint
    where conname = 'buyer_payment_notice_settings_default_days_chk'
  ) then
    alter table public.buyer_payment_notice_settings
      add constraint buyer_payment_notice_settings_default_days_chk
      check (default_notice_days_after between 1 and 120);
  end if;
end;
$$;

create or replace function public.set_buyer_payment_notice_settings_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists trg_buyer_payment_notice_settings_updated_at
  on public.buyer_payment_notice_settings;

create trigger trg_buyer_payment_notice_settings_updated_at
before update on public.buyer_payment_notice_settings
for each row
execute function public.set_buyer_payment_notice_settings_updated_at();

alter table public.buyer_payment_notice_settings enable row level security;

grant select on public.buyer_payment_notice_settings to authenticated;

drop policy if exists "buyer_payment_notice_settings_select_own_account"
  on public.buyer_payment_notice_settings;

create policy "buyer_payment_notice_settings_select_own_account"
  on public.buyer_payment_notice_settings
  for select
  to authenticated
  using (
    exists (
      select 1
      from public.buyers
      where buyers.id = buyer_payment_notice_settings.buyer_id
        and (
          buyers.user_id = auth.uid()
          or lower(coalesce(buyers.email, '')) = lower(coalesce(auth.jwt() ->> 'email', ''))
        )
    )
  );

create table if not exists public.buyer_payment_notice_logs (
  id bigint generated always as identity primary key,
  created_at timestamptz not null default now(),
  buyer_id bigint not null references public.buyers (id) on delete cascade,
  puppy_id bigint null references public.puppies (id) on delete set null,
  payment_id text null,
  notice_kind text not null,
  notice_key text not null,
  notice_date date null,
  due_date date null,
  status text not null default 'sent',
  recipient_email text not null,
  subject text not null,
  provider text not null default 'resend',
  provider_message_id text null,
  meta jsonb not null default '{}'::jsonb
);

create unique index if not exists buyer_payment_notice_logs_notice_key_uidx
  on public.buyer_payment_notice_logs (notice_key);

create index if not exists buyer_payment_notice_logs_buyer_created_idx
  on public.buyer_payment_notice_logs (buyer_id, created_at desc);

create index if not exists buyer_payment_notice_logs_notice_kind_idx
  on public.buyer_payment_notice_logs (notice_kind, created_at desc);

create index if not exists buyer_payment_notice_logs_due_date_idx
  on public.buyer_payment_notice_logs (due_date desc nulls last);

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'buyer_payment_notice_logs_notice_kind_chk'
  ) then
    alter table public.buyer_payment_notice_logs
      add constraint buyer_payment_notice_logs_notice_kind_chk
      check (notice_kind in ('receipt', 'due_reminder', 'late_notice', 'default_notice', 'manual_notice'));
  end if;
end;
$$;

alter table public.buyer_payment_notice_logs enable row level security;

grant select on public.buyer_payment_notice_logs to authenticated;

drop policy if exists "buyer_payment_notice_logs_select_own_account"
  on public.buyer_payment_notice_logs;

create policy "buyer_payment_notice_logs_select_own_account"
  on public.buyer_payment_notice_logs
  for select
  to authenticated
  using (
    exists (
      select 1
      from public.buyers
      where buyers.id = buyer_payment_notice_logs.buyer_id
        and (
          buyers.user_id = auth.uid()
          or lower(coalesce(buyers.email, '')) = lower(coalesce(auth.jwt() ->> 'email', ''))
        )
    )
  );
