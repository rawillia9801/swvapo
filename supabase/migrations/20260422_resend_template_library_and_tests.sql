create or replace function public.set_admin_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create table if not exists public.admin_message_templates (
  id bigint generated always as identity primary key,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  template_key text not null,
  category text not null,
  label text not null,
  description text null,
  channel text not null default 'email',
  provider text not null default 'resend',
  subject text not null,
  body text not null,
  automation_enabled boolean not null default true,
  is_active boolean not null default true,
  preview_payload jsonb not null default '{}'::jsonb,
  updated_by_email text null
);

alter table public.admin_message_templates
  add column if not exists created_at timestamptz not null default now(),
  add column if not exists updated_at timestamptz not null default now(),
  add column if not exists template_key text,
  add column if not exists category text,
  add column if not exists label text,
  add column if not exists description text null,
  add column if not exists channel text not null default 'email',
  add column if not exists provider text not null default 'resend',
  add column if not exists subject text,
  add column if not exists body text,
  add column if not exists automation_enabled boolean not null default true,
  add column if not exists is_active boolean not null default true,
  add column if not exists preview_payload jsonb not null default '{}'::jsonb,
  add column if not exists updated_by_email text null;

create unique index if not exists admin_message_templates_template_key_uidx
  on public.admin_message_templates (template_key);

create index if not exists admin_message_templates_category_idx
  on public.admin_message_templates (category, is_active, updated_at desc);

drop trigger if exists trg_admin_message_templates_updated_at
  on public.admin_message_templates;

create trigger trg_admin_message_templates_updated_at
before update on public.admin_message_templates
for each row
execute function public.set_admin_updated_at();

alter table public.admin_message_templates enable row level security;

create table if not exists public.admin_message_template_test_sends (
  id bigint generated always as identity primary key,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  template_key text not null,
  category text null,
  label text null,
  recipient_email text not null,
  subject text not null,
  provider text not null default 'resend',
  provider_message_id text null,
  status text not null default 'sent',
  render_mode text not null default 'draft',
  payload jsonb not null default '{}'::jsonb,
  missing_variables text[] not null default '{}'::text[],
  sent_by_email text null,
  last_event_type text null,
  last_event_at timestamptz null,
  delivered_at timestamptz null,
  opened_at timestamptz null,
  clicked_at timestamptz null,
  bounced_at timestamptz null,
  complained_at timestamptz null,
  failed_at timestamptz null,
  suppressed_at timestamptz null,
  delivery_delayed_at timestamptz null,
  open_count integer not null default 0,
  click_count integer not null default 0,
  meta jsonb not null default '{}'::jsonb
);

create index if not exists admin_message_template_test_sends_provider_message_idx
  on public.admin_message_template_test_sends (provider_message_id);

create index if not exists admin_message_template_test_sends_template_created_idx
  on public.admin_message_template_test_sends (template_key, created_at desc);

create index if not exists admin_message_template_test_sends_last_event_idx
  on public.admin_message_template_test_sends (last_event_at desc nulls last);

drop trigger if exists trg_admin_message_template_test_sends_updated_at
  on public.admin_message_template_test_sends;

create trigger trg_admin_message_template_test_sends_updated_at
before update on public.admin_message_template_test_sends
for each row
execute function public.set_admin_updated_at();

alter table public.admin_message_template_test_sends enable row level security;

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
    'buyer_application_received',
    'buyer_lifecycle',
    'Application Received',
    'Sent immediately after a buyer submits an application. Confirms receipt and sets expectations for next steps.',
    'email',
    'resend',
    'We received your application 🐾',
    $$Hi {{buyer_name}},

Thank you for submitting your application.

We've received everything on our end and will be reviewing it shortly.

If we need anything additional, we'll reach out. Otherwise, you can expect an update once your application has been processed.

We appreciate your interest and look forward to working with you.

Southwest Virginia Chihuahua$$,
    true,
    true,
    '{"buyer_name":"Sarah"}'::jsonb
  ),
  (
    'buyer_application_approved',
    'buyer_lifecycle',
    'Application Approved',
    'Sent when a buyer''s application is approved. Invites them to move forward with reserving a puppy or next steps.',
    'email',
    'resend',
    'Your application has been approved 🐾',
    $$Hi {{buyer_name}},

Great news - your application has been approved.

You're now able to move forward with reserving a puppy.

If you already have a specific puppy in mind, you can proceed with the reservation directly through your Puppy Portal. If you're still deciding, feel free to take your time - we're happy to help guide you if needed.

We look forward to helping you find the perfect match.

Southwest Virginia Chihuahua$$,
    true,
    true,
    '{"buyer_name":"Sarah"}'::jsonb
  ),
  (
    'buyer_reservation_confirmed',
    'buyer_lifecycle',
    'Reservation Confirmed',
    'Sent when a buyer places a deposit and reserves a puppy. Confirms reservation and outlines next steps.',
    'email',
    'resend',
    '{{puppy_name}} is officially reserved 🐾',
    $$Hi {{buyer_name}},

{{puppy_name}} is now officially reserved for you.

We've received your deposit, and everything is set on our end.

From here, you'll be able to follow along with updates, documents, and your payment plan directly through your Puppy Portal.

As {{puppy_name}} grows, we'll continue sharing updates and preparing for go-home day.

If anything comes up along the way, we're here - but otherwise, everything will be guided step-by-step inside your portal.

Southwest Virginia Chihuahua$$,
    true,
    true,
    '{"buyer_name":"Sarah","puppy_name":"Bella"}'::jsonb
  ),
  (
    'buyer_go_home_ready',
    'buyer_lifecycle',
    'Go-Home Ready',
    'Sent when a puppy is approaching go-home readiness. Prepares the buyer for final steps, scheduling, and transition.',
    'email',
    'resend',
    '{{puppy_name}} is almost ready to go home 🐾',
    $$Hi {{buyer_name}},

{{puppy_name}} is getting very close to go-home day.

Over the next few days, we'll be finalizing the remaining details to make sure everything is ready - including pickup or transportation, final documents, and any remaining balance.

You'll be able to review and complete everything through your Puppy Portal.

We'll guide you through each step so the transition is smooth and stress-free.

Southwest Virginia Chihuahua$$,
    true,
    true,
    '{"buyer_name":"Sarah","puppy_name":"Bella"}'::jsonb
  ),
  (
    'payment_received',
    'payments',
    'Payment Receipt',
    'Automatic receipt sent when a buyer payment is posted.',
    'email',
    'resend',
    'Payment received for {{puppy_name}}',
    $$Hi {{buyer_name}},

We've received your payment for {{puppy_name}}.

Amount received: {{amount_paid}}
Remaining balance: {{balance}}

Your account has been updated and reflected in your Puppy Portal.

Southwest Virginia Chihuahua$$,
    true,
    true,
    '{"buyer_name":"Sarah","puppy_name":"Bella","amount_paid":"$300.00","balance":"$1,180.00"}'::jsonb
  ),
  (
    'payment_reminder_upcoming',
    'payments',
    'Payment Reminder',
    'Friendly reminder sent before an upcoming installment due date.',
    'email',
    'resend',
    'Upcoming payment for {{puppy_name}}',
    $$Hi {{buyer_name}},

Just a quick heads up - your next payment for {{puppy_name}} is coming up on {{due_date}}.

Amount due: {{monthly_amount}}
Current balance: {{balance}}

You can take care of it anytime through your Puppy Portal.

As always, if anything changes on your end, we're here to work with you.

Southwest Virginia Chihuahua$$,
    true,
    true,
    '{"buyer_name":"Sarah","puppy_name":"Bella","due_date":"May 1, 2026","monthly_amount":"$250.00","balance":"$1,180.00"}'::jsonb
  ),
  (
    'payment_late_notice',
    'payments',
    'Payment Overdue',
    'Operational overdue notice when an installment is past due.',
    'email',
    'resend',
    'Payment past due for {{puppy_name}}',
    $$Hi {{buyer_name}},

We wanted to let you know that a scheduled payment for {{puppy_name}} is now past due.

Past due amount: {{amount_due}}
Current balance: {{balance}}

Please take a moment to bring the account current through your Puppy Portal.

If there's something going on, communication goes a long way - just let us know.

Southwest Virginia Chihuahua$$,
    true,
    true,
    '{"buyer_name":"Sarah","puppy_name":"Bella","amount_due":"$250.00","balance":"$1,180.00"}'::jsonb
  ),
  (
    'payment_default_notice',
    'payments',
    'Payment Default Notice',
    'Escalated notice for significantly overdue accounts.',
    'email',
    'resend',
    'Immediate attention required for {{puppy_name}}''s account',
    $$Hi {{buyer_name}},

Despite previous reminders, the account for {{puppy_name}} remains unresolved.

Immediate action is required to prevent further steps regarding the agreement.

Balance due: {{balance}}

Please log into your Puppy Portal today to resolve this.

Southwest Virginia Chihuahua$$,
    true,
    true,
    '{"buyer_name":"Sarah","puppy_name":"Bella","balance":"$1,180.00"}'::jsonb
  ),
  (
    'payment_credit_applied',
    'payments',
    'Payment Credit Applied',
    'Use when a credit or manual adjustment changes the buyer balance.',
    'email',
    'resend',
    'A credit has been applied to {{puppy_name}}''s account',
    $$Hi {{buyer_name}},

A credit has been applied to your account for {{puppy_name}}.

Updated balance: {{balance}}

This adjustment has already been reflected in your payment plan.

If you'd ever like a full breakdown of your account or schedule, everything is available inside your Puppy Portal.

Southwest Virginia Chihuahua$$,
    true,
    true,
    '{"buyer_name":"Sarah","puppy_name":"Bella","balance":"$1,180.00"}'::jsonb
  ),
  (
    'payment_plan_created',
    'payments',
    'Payment Plan Created',
    'Sent when a buyer''s payment plan is created and ready to review.',
    'email',
    'resend',
    'Your payment plan for {{puppy_name}} is ready',
    $$Hi {{buyer_name}},

Your payment plan for {{puppy_name}} has been created and is ready inside your Puppy Portal.

Monthly amount: {{monthly_amount}}
Next due date: {{due_date}}
Current balance: {{balance}}

Please review the schedule when you have a moment so everything stays organized from the start.

Southwest Virginia Chihuahua$$,
    true,
    true,
    '{"buyer_name":"Sarah","puppy_name":"Bella","monthly_amount":"$250.00","due_date":"May 1, 2026","balance":"$1,180.00"}'::jsonb
  ),
  (
    'payment_plan_updated',
    'payments',
    'Payment Plan Updated',
    'Sent when payment plan terms, schedule, or balance details are updated.',
    'email',
    'resend',
    'Your payment plan for {{puppy_name}} has been updated',
    $$Hi {{buyer_name}},

We've updated the payment plan for {{puppy_name}}.

Updated monthly amount: {{monthly_amount}}
Next due date: {{due_date}}
Current balance: {{balance}}

The newest details are available in your Puppy Portal.

Southwest Virginia Chihuahua$$,
    true,
    true,
    '{"buyer_name":"Sarah","puppy_name":"Bella","monthly_amount":"$225.00","due_date":"May 1, 2026","balance":"$1,180.00"}'::jsonb
  ),
  (
    'payment_paid_off',
    'payments',
    'Payment Paid Off',
    'Sent when a buyer''s balance reaches zero.',
    'email',
    'resend',
    '{{puppy_name}}''s account is paid in full',
    $$Hi {{buyer_name}},

Wonderful news - {{puppy_name}}'s account is now paid in full.

Your Puppy Portal has been updated to reflect the completed balance.

Thank you for keeping everything organized with us.

Southwest Virginia Chihuahua$$,
    true,
    true,
    '{"buyer_name":"Sarah","puppy_name":"Bella"}'::jsonb
  ),
  (
    'documents_ready_to_sign',
    'documents',
    'Documents Ready to Sign',
    'Sent when buyer-facing documents are ready for review and signature.',
    'email',
    'resend',
    'Documents ready for your review and signature',
    $$Hi {{buyer_name}},

Your documents for {{puppy_name}} are now ready.

Please take a few moments to review and sign them through your Puppy Portal.

Everything has been prepared for you, and once completed, your file will be fully up to date.

Southwest Virginia Chihuahua$$,
    true,
    true,
    '{"buyer_name":"Sarah","puppy_name":"Bella"}'::jsonb
  ),
  (
    'documents_signature_reminder',
    'documents',
    'Signature Reminder',
    'Reminder sent when documents are still awaiting signature.',
    'email',
    'resend',
    'Reminder: documents still awaiting signature',
    $$Hi {{buyer_name}},

This is a friendly reminder that documents for {{puppy_name}} are still waiting for your review and signature.

Please complete them through your Puppy Portal when you have a moment.

Southwest Virginia Chihuahua$$,
    true,
    true,
    '{"buyer_name":"Sarah","puppy_name":"Bella"}'::jsonb
  ),
  (
    'documents_completed',
    'documents',
    'Documents Completed',
    'Sent when required documents have been signed and filed.',
    'email',
    'resend',
    'Your documents for {{puppy_name}} are complete',
    $$Hi {{buyer_name}},

Your documents for {{puppy_name}} have been completed and filed.

Everything is up to date on our end, and your Puppy Portal will continue to show the latest placement steps.

Southwest Virginia Chihuahua$$,
    true,
    true,
    '{"buyer_name":"Sarah","puppy_name":"Bella"}'::jsonb
  ),
  (
    'transport_quote_ready',
    'transport',
    'Transport Quote Ready',
    'Sent when a pickup, meet-up, or transport quote is ready for review.',
    'email',
    'resend',
    'Transport quote ready for {{puppy_name}}',
    $$Hi {{buyer_name}},

Your transport quote for {{puppy_name}} is ready to review.

Estimated transport cost: {{transport_quote}}
Proposed location: {{meeting_location}}

You can review the details in your Puppy Portal and let us know what works best.

Southwest Virginia Chihuahua$$,
    true,
    true,
    '{"buyer_name":"Sarah","puppy_name":"Bella","transport_quote":"$185.00","meeting_location":"Bristol, VA"}'::jsonb
  ),
  (
    'transport_scheduled',
    'transport',
    'Transport Scheduled',
    'Sent when transport has been scheduled for a buyer.',
    'email',
    'resend',
    'Transport scheduled for {{puppy_name}}',
    $$Hi {{buyer_name}},

Your transport for {{puppy_name}} has been scheduled.

Date: {{transport_date}}
Location: {{meeting_location}}

We'll keep you updated as the day approaches so everything goes smoothly.

Southwest Virginia Chihuahua$$,
    true,
    true,
    '{"buyer_name":"Sarah","puppy_name":"Bella","transport_date":"May 10, 2026","meeting_location":"Bristol, VA"}'::jsonb
  ),
  (
    'transport_day_reminder',
    'transport',
    'Transport Day Reminder',
    'Sent shortly before pickup, meet-up, or transport day.',
    'email',
    'resend',
    'Reminder: transport day for {{puppy_name}}',
    $$Hi {{buyer_name}},

This is a quick reminder that transport for {{puppy_name}} is coming up.

Date: {{transport_date}}
Location: {{meeting_location}}
Time: {{meeting_time}}

Please keep your phone nearby that day so we can coordinate smoothly.

Southwest Virginia Chihuahua$$,
    true,
    true,
    '{"buyer_name":"Sarah","puppy_name":"Bella","transport_date":"May 10, 2026","meeting_location":"Bristol, VA","meeting_time":"2:00 PM"}'::jsonb
  ),
  (
    'puppy_weekly_update',
    'puppy_updates',
    'Weekly Puppy Update',
    'General weekly puppy progress update.',
    'email',
    'resend',
    '{{puppy_name}} update 🐾',
    $$Hi {{buyer_name}},

We wanted to share a quick update on {{puppy_name}}.

{{custom_update}}

We'll continue keeping you updated as {{puppy_name}} grows and gets closer to going home.

Southwest Virginia Chihuahua$$,
    true,
    true,
    '{"buyer_name":"Sarah","puppy_name":"Bella","custom_update":"Bella had a great week and is continuing to do well."}'::jsonb
  ),
  (
    'puppy_milestone_update',
    'puppy_updates',
    'Puppy Milestone Update',
    'Sent when a meaningful development or readiness milestone is shared.',
    'email',
    'resend',
    '{{puppy_name}} reached a new milestone 🐾',
    $$Hi {{buyer_name}},

{{puppy_name}} reached a new milestone.

Milestone: {{milestone_label}}
Update: {{milestone_note}}

We love being able to share these little steps as your puppy grows.

Southwest Virginia Chihuahua$$,
    true,
    true,
    '{"buyer_name":"Sarah","puppy_name":"Bella","milestone_label":"Walking well","milestone_note":"Bella is getting steadier every day."}'::jsonb
  ),
  (
    'post_go_home_checkin',
    'relationship',
    'Post Go-Home Check-In',
    'Sent after placement to check in and support the transition home.',
    'email',
    'resend',
    'Checking in on {{puppy_name}}',
    $$Hi {{buyer_name}},

We wanted to check in and see how {{puppy_name}} is settling in.

The first few days can be exciting and full, so please reach out if you have any questions about food, routines, or the transition.

We're always happy to help.

Southwest Virginia Chihuahua$$,
    true,
    true,
    '{"buyer_name":"Sarah","puppy_name":"Bella"}'::jsonb
  ),
  (
    'buyer_referral_request',
    'relationship',
    'Referral Request',
    'Sent to happy families after placement to invite referrals or reviews.',
    'email',
    'resend',
    'A small favor from Southwest Virginia Chihuahua',
    $$Hi {{buyer_name}},

We hope {{puppy_name}} is doing beautifully with your family.

If you've had a wonderful experience with us, we would be grateful if you shared our name with another Chihuahua-loving family or left a kind review.

Thank you again for trusting us.

Southwest Virginia Chihuahua$$,
    true,
    true,
    '{"buyer_name":"Sarah","puppy_name":"Bella"}'::jsonb
  )
on conflict (template_key) do nothing;
