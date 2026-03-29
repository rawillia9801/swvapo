create table if not exists public.chichi_memory_records (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  last_referenced_at timestamptz null default now(),
  scope text not null check (scope in ('global', 'portal', 'public')),
  memory_kind text not null check (memory_kind in ('instruction', 'preference', 'context', 'business')),
  memory_key text null,
  subject text null,
  content text not null,
  summary text null,
  user_id uuid null references auth.users (id) on delete cascade,
  visitor_id uuid null,
  buyer_id bigint null references public.buyers (id) on delete cascade,
  puppy_id bigint null references public.puppies (id) on delete cascade,
  importance integer not null default 5,
  is_active boolean not null default true,
  source_route text null,
  meta jsonb not null default '{}'::jsonb
);

create index if not exists chichi_memory_scope_idx
  on public.chichi_memory_records (scope, is_active, updated_at desc);

create index if not exists chichi_memory_user_idx
  on public.chichi_memory_records (user_id, updated_at desc);

create index if not exists chichi_memory_visitor_idx
  on public.chichi_memory_records (visitor_id, updated_at desc);

create index if not exists chichi_memory_buyer_idx
  on public.chichi_memory_records (buyer_id, updated_at desc);

create index if not exists chichi_memory_puppy_idx
  on public.chichi_memory_records (puppy_id, updated_at desc);

create index if not exists chichi_memory_key_idx
  on public.chichi_memory_records (scope, memory_key);

create or replace function public.set_chichi_memory_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists trg_chichi_memory_updated_at on public.chichi_memory_records;

create trigger trg_chichi_memory_updated_at
before update on public.chichi_memory_records
for each row
execute function public.set_chichi_memory_updated_at();
