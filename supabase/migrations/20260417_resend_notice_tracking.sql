alter table public.buyer_payment_notice_logs
  add column if not exists last_event_type text null,
  add column if not exists last_event_at timestamptz null,
  add column if not exists delivered_at timestamptz null,
  add column if not exists opened_at timestamptz null,
  add column if not exists clicked_at timestamptz null,
  add column if not exists bounced_at timestamptz null,
  add column if not exists complained_at timestamptz null,
  add column if not exists failed_at timestamptz null,
  add column if not exists suppressed_at timestamptz null,
  add column if not exists delivery_delayed_at timestamptz null,
  add column if not exists open_count integer not null default 0,
  add column if not exists click_count integer not null default 0;

create index if not exists buyer_payment_notice_logs_provider_message_idx
  on public.buyer_payment_notice_logs (provider_message_id);

create index if not exists buyer_payment_notice_logs_last_event_idx
  on public.buyer_payment_notice_logs (last_event_at desc nulls last);

insert into public.admin_message_templates (
  template_key,
  category,
  label,
  description,
  channel,
  provider,
  subject,
  body,
  automation_enabled,
  is_active,
  preview_payload
)
values
  (
    'payment_receipt',
    'payments',
    'Payment Receipt',
    'Automatic receipt sent when a buyer payment is posted.',
    'email',
    'resend',
    'Payment received for {{puppy_name}}',
    $$Hi {{buyer_name}},

We received your payment for {{puppy_name}}.

Payment amount: {{payment_amount}}
Payment date: {{payment_date}}
Updated balance: {{balance}}

You can review the latest account details in the portal any time.

Southwest Virginia Chihuahua$$,
    true,
    true,
    '{"buyer_name":"The Carter Family","puppy_name":"Baby Girl Frey","payment_amount":"$300.00","payment_date":"April 17, 2026","balance":"$1,500.00"}'::jsonb
  ),
  (
    'payment_credit_applied',
    'payments',
    'Payment Credit Applied',
    'Use when a credit or manual adjustment changes the buyer balance.',
    'email',
    'resend',
    'Credit applied to {{puppy_name}} payment plan',
    $$Hi {{buyer_name}},

We applied a credit to {{puppy_name}}'s payment plan.

Credit amount: {{credit_amount}}
Updated balance: {{balance}}

You can review the updated account details in the portal, and you are always welcome to reply if you want us to walk through the changes with you.

Southwest Virginia Chihuahua$$,
    true,
    true,
    '{"buyer_name":"The Carter Family","puppy_name":"Baby Girl Frey","credit_amount":"$125.00","balance":"$1,375.00"}'::jsonb
  )
on conflict (template_key) do update
set
  category = excluded.category,
  label = excluded.label,
  description = excluded.description,
  channel = excluded.channel,
  provider = excluded.provider,
  subject = excluded.subject,
  body = excluded.body,
  automation_enabled = excluded.automation_enabled,
  is_active = excluded.is_active,
  preview_payload = excluded.preview_payload;
