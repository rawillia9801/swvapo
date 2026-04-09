create table if not exists public.integration_credentials (
  provider text primary key,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  connected_at timestamptz null,
  last_refreshed_at timestamptz null,
  status text not null default 'disconnected' check (status in ('connected', 'disconnected', 'error')),
  account_id text null,
  soid text null,
  scope text null,
  api_domain text null,
  refresh_token text null,
  token_type text null,
  connected_by_user_id uuid null references auth.users (id) on delete set null,
  connected_by_email text null,
  meta jsonb not null default '{}'::jsonb
);

create index if not exists integration_credentials_status_idx
  on public.integration_credentials (status, updated_at desc);

create or replace function public.set_integration_credentials_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists trg_integration_credentials_updated_at on public.integration_credentials;

create trigger trg_integration_credentials_updated_at
before update on public.integration_credentials
for each row
execute function public.set_integration_credentials_updated_at();

alter table public.integration_credentials enable row level security;
