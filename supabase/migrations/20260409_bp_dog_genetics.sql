alter table public.bp_dogs
  add column if not exists genetics_summary text,
  add column if not exists genetics_raw text,
  add column if not exists genetics_report_url text,
  add column if not exists genetics_updated_at timestamptz;
