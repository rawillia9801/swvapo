create table if not exists public.portal_notification_dismissals (
  user_id uuid not null references auth.users (id) on delete cascade,
  notification_key text not null,
  dismissed_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  primary key (user_id, notification_key)
);

create index if not exists portal_notification_dismissals_user_date_idx
  on public.portal_notification_dismissals (user_id, dismissed_at desc);

alter table public.portal_notification_dismissals enable row level security;

grant select, insert, update, delete
  on public.portal_notification_dismissals
  to authenticated;

drop policy if exists "portal_notification_dismissals_select_own"
  on public.portal_notification_dismissals;

create policy "portal_notification_dismissals_select_own"
  on public.portal_notification_dismissals
  for select
  to authenticated
  using (auth.uid() = user_id);

drop policy if exists "portal_notification_dismissals_insert_own"
  on public.portal_notification_dismissals;

create policy "portal_notification_dismissals_insert_own"
  on public.portal_notification_dismissals
  for insert
  to authenticated
  with check (auth.uid() = user_id);

drop policy if exists "portal_notification_dismissals_update_own"
  on public.portal_notification_dismissals;

create policy "portal_notification_dismissals_update_own"
  on public.portal_notification_dismissals
  for update
  to authenticated
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

drop policy if exists "portal_notification_dismissals_delete_own"
  on public.portal_notification_dismissals;

create policy "portal_notification_dismissals_delete_own"
  on public.portal_notification_dismissals
  for delete
  to authenticated
  using (auth.uid() = user_id);
