create or replace function public.set_admin_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create table if not exists public.puppy_admin_profiles (
  id bigint generated always as identity primary key,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  puppy_id bigint not null references public.puppies (id) on delete cascade,
  registered_name text null,
  public_visibility boolean not null default true,
  portal_visibility boolean not null default false,
  featured_listing boolean not null default false,
  special_care_flag boolean not null default false,
  special_care_notes text null,
  feeding_notes text null,
  lineage_notes text null,
  breeder_notes text null,
  buyer_packet_ready boolean not null default false,
  document_packet_ready boolean not null default false,
  transport_ready boolean not null default false,
  go_home_ready boolean not null default false,
  updated_by_email text null
);

create unique index if not exists puppy_admin_profiles_puppy_uidx
  on public.puppy_admin_profiles (puppy_id);

drop trigger if exists trg_puppy_admin_profiles_updated_at
  on public.puppy_admin_profiles;

create trigger trg_puppy_admin_profiles_updated_at
before update on public.puppy_admin_profiles
for each row
execute function public.set_admin_updated_at();

alter table public.puppy_admin_profiles enable row level security;

create table if not exists public.admin_checklist_templates (
  id bigint generated always as identity primary key,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  scope text not null default 'puppy_development',
  key text not null,
  label text not null,
  description text null,
  category text not null default 'development',
  sort_order integer not null default 0,
  required_for_website boolean not null default false,
  required_for_portal boolean not null default false,
  required_for_go_home boolean not null default false,
  visible_to_buyer boolean not null default false,
  is_active boolean not null default true
);

create unique index if not exists admin_checklist_templates_scope_key_uidx
  on public.admin_checklist_templates (scope, key);

create index if not exists admin_checklist_templates_scope_active_idx
  on public.admin_checklist_templates (scope, is_active, sort_order asc, id asc);

drop trigger if exists trg_admin_checklist_templates_updated_at
  on public.admin_checklist_templates;

create trigger trg_admin_checklist_templates_updated_at
before update on public.admin_checklist_templates
for each row
execute function public.set_admin_updated_at();

alter table public.admin_checklist_templates enable row level security;

create table if not exists public.puppy_checklist_progress (
  id bigint generated always as identity primary key,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  puppy_id bigint not null references public.puppies (id) on delete cascade,
  template_id bigint not null references public.admin_checklist_templates (id) on delete cascade,
  completed boolean not null default false,
  completed_at timestamptz null,
  visible_to_buyer boolean not null default false,
  notes text null,
  updated_by_email text null
);

create unique index if not exists puppy_checklist_progress_puppy_template_uidx
  on public.puppy_checklist_progress (puppy_id, template_id);

create index if not exists puppy_checklist_progress_puppy_idx
  on public.puppy_checklist_progress (puppy_id, updated_at desc);

drop trigger if exists trg_puppy_checklist_progress_updated_at
  on public.puppy_checklist_progress;

create trigger trg_puppy_checklist_progress_updated_at
before update on public.puppy_checklist_progress
for each row
execute function public.set_admin_updated_at();

alter table public.puppy_checklist_progress enable row level security;

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

create table if not exists public.admin_workflow_settings (
  id bigint generated always as identity primary key,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  workflow_key text not null,
  category text not null,
  label text not null,
  description text null,
  status text not null default 'active',
  owner text null,
  cadence_label text null,
  trigger_label text null,
  next_run_hint text null,
  settings jsonb not null default '{}'::jsonb,
  is_visible boolean not null default true,
  updated_by_email text null
);

create unique index if not exists admin_workflow_settings_workflow_key_uidx
  on public.admin_workflow_settings (workflow_key);

create index if not exists admin_workflow_settings_category_idx
  on public.admin_workflow_settings (category, status, updated_at desc);

drop trigger if exists trg_admin_workflow_settings_updated_at
  on public.admin_workflow_settings;

create trigger trg_admin_workflow_settings_updated_at
before update on public.admin_workflow_settings
for each row
execute function public.set_admin_updated_at();

alter table public.admin_workflow_settings enable row level security;

insert into public.admin_checklist_templates (
  scope,
  key,
  label,
  description,
  category,
  sort_order,
  required_for_website,
  required_for_portal,
  required_for_go_home,
  visible_to_buyer,
  is_active
)
values
  ('puppy_development', 'eyes_open', 'Eyes Open', 'Track early development milestones for breeder review.', 'development', 10, false, false, false, false, true),
  ('puppy_development', 'walking_well', 'Walking Well', 'Useful for owner updates and placement confidence.', 'development', 20, false, true, false, true, true),
  ('puppy_development', 'eating_independently', 'Eating Independently', 'Important before portal updates and go-home planning.', 'care', 30, false, true, true, true, true),
  ('puppy_development', 'stable_weight_gain', 'Stable Weight Gain', 'Signals strong care compliance and early readiness.', 'care', 40, false, true, true, true, true),
  ('puppy_development', 'socialization_started', 'Socialization Started', 'Helps communicate development progress to buyers.', 'development', 50, false, true, false, true, true),
  ('puppy_development', 'litter_training_progress', 'Litter Training Progress', 'Supports portal updates and go-home readiness.', 'development', 60, false, true, true, true, true),
  ('puppy_development', 'first_deworming', 'First Deworming', 'Required before go-home and useful for portal communication.', 'health', 70, false, true, true, true, true),
  ('puppy_development', 'second_deworming', 'Second Deworming', 'Tracks continuing care compliance.', 'health', 80, false, true, true, true, true),
  ('puppy_development', 'first_vaccine', 'First Vaccine', 'Important for buyer communication and go-home readiness.', 'health', 90, false, true, true, true, true),
  ('puppy_development', 'bath_grooming_intro', 'Bath / Grooming Intro', 'Supports progress updates and breeder prep notes.', 'development', 100, false, true, false, true, true),
  ('puppy_development', 'vet_check', 'Vet Check', 'Required for stronger health readiness confidence.', 'health', 110, false, true, true, true, true),
  ('puppy_development', 'photo_set_complete', 'Photo Set Complete', 'Required before public listing readiness.', 'website', 120, true, false, false, false, true),
  ('puppy_development', 'website_copy_complete', 'Website Copy Complete', 'Required before public listing readiness.', 'website', 130, true, false, false, false, true),
  ('puppy_development', 'buyer_packet_ready', 'Buyer Packet Ready', 'Supports portal and document readiness.', 'documents', 140, false, true, true, true, true),
  ('puppy_development', 'go_home_ready', 'Go-Home Ready', 'Final operational milestone before placement closes.', 'placement', 150, false, true, true, true, true)
on conflict (scope, key) do nothing;

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
    'deposit_received',
    'payments',
    'Deposit Received',
    'Confirms that a deposit or reservation payment has been posted.',
    'email',
    'resend',
    'Deposit received for {{puppy_name}}',
    $$Hi {{buyer_name}},

We received your deposit for {{puppy_name}} and your puppy file is now marked as {{puppy_status}}.

What happens next:
- your payment summary is available in the portal
- your document workflow will stay visible as items are ready
- ChiChi can help explain next steps any time inside the portal

If you need anything before the next update, just reply here.

Southwest Virginia Chihuahua$$,
    true,
    true,
    '{"buyer_name":"The Carter Family","puppy_name":"Baby Girl Frey","puppy_status":"reserved"}'::jsonb
  ),
  (
    'application_received',
    'applications',
    'Application Received',
    'Confirms that an application or wait-list request came through.',
    'email',
    'resend',
    'We received your application',
    $$Hi {{buyer_name}},

We received your application and it is now in review.

ChiChi and the buyer portal will show your next visible step as records move forward. If we need clarification or additional information, we will reach out using the contact details on file.

Southwest Virginia Chihuahua$$,
    true,
    true,
    '{"buyer_name":"The Carter Family"}'::jsonb
  ),
  (
    'application_approved',
    'applications',
    'Application Approved',
    'Shares approval and next-step guidance.',
    'email',
    'resend',
    'Your application has been approved',
    $$Hi {{buyer_name}},

Your application has been approved and your file is ready for the next placement step.

Next steps:
- review any portal documents that are ready
- watch for puppy-match or reservation communication
- reply if you want help reviewing payment or transport options

Southwest Virginia Chihuahua$$,
    true,
    true,
    '{"buyer_name":"The Carter Family"}'::jsonb
  ),
  (
    'puppy_reserved',
    'placements',
    'Puppy Reserved',
    'Confirms a buyer-to-puppy match or reservation.',
    'email',
    'resend',
    '{{puppy_name}} is now reserved for your family',
    $$Hi {{buyer_name}},

{{puppy_name}} is now marked as reserved for your family.

The portal will continue to surface:
- care and progress updates when they are shared
- document and packet readiness
- payment plan or balance details when applicable

If you need help with the next step, ChiChi can walk you through it.

Southwest Virginia Chihuahua$$,
    true,
    true,
    '{"buyer_name":"The Carter Family","puppy_name":"Baby Girl Frey"}'::jsonb
  ),
  (
    'payment_reminder',
    'payments',
    'Payment Reminder',
    'Friendly installment or balance reminder.',
    'email',
    'resend',
    'Friendly reminder: payment due {{due_date}}',
    $$Hi {{buyer_name}},

This is a friendly reminder that your next payment for {{puppy_name}} is due {{due_date}}.

Current balance snapshot: {{balance}}
Current monthly amount: {{monthly_amount}}

If you need help reviewing the plan or timing, just reply here and we can help.

Southwest Virginia Chihuahua$$,
    true,
    true,
    '{"buyer_name":"The Carter Family","puppy_name":"Baby Girl Frey","due_date":"May 15, 2026","balance":"$1,800","monthly_amount":"$300"}'::jsonb
  ),
  (
    'payment_overdue',
    'payments',
    'Payment Overdue',
    'Overdue balance notice with softer operational language.',
    'email',
    'resend',
    'Payment for {{puppy_name}} is now overdue',
    $$Hi {{buyer_name}},

The scheduled payment for {{puppy_name}} is now overdue.

Current balance snapshot: {{balance}}
Original due date: {{due_date}}

If you already made the payment, or need help coordinating next steps, reply here so we can review the account with you.

Southwest Virginia Chihuahua$$,
    true,
    true,
    '{"buyer_name":"The Carter Family","puppy_name":"Baby Girl Frey","due_date":"May 15, 2026","balance":"$1,800"}'::jsonb
  ),
  (
    'transport_scheduling',
    'transport',
    'Transport Scheduling',
    'Coordinates pickup, meet-up, or delivery planning.',
    'email',
    'resend',
    'Transport and pickup planning for {{puppy_name}}',
    $$Hi {{buyer_name}},

We are ready to confirm the transport or pickup plan for {{puppy_name}}.

Current transport note:
{{transport_note}}

If you need to confirm timing, location, or a change request, reply here and we will coordinate the plan.

Southwest Virginia Chihuahua$$,
    true,
    true,
    '{"buyer_name":"The Carter Family","puppy_name":"Baby Girl Frey","transport_note":"Pickup requested in Charlotte, NC."}'::jsonb
  ),
  (
    'document_ready',
    'documents',
    'Document Ready',
    'Notifies a buyer that a packet or agreement is ready.',
    'email',
    'resend',
    '{{document_name}} is ready in your portal',
    $$Hi {{buyer_name}},

{{document_name}} is ready in your portal.

You can review the document, check any signing steps, and follow the next action directly from your buyer workspace.

If you need help understanding what comes next, reply here and ChiChi can walk you through it.

Southwest Virginia Chihuahua$$,
    true,
    true,
    '{"buyer_name":"The Carter Family","document_name":"Bill of Sale"}'::jsonb
  ),
  (
    'signature_reminder',
    'documents',
    'Signature Reminder',
    'Reminder for unsigned paperwork.',
    'email',
    'resend',
    'Reminder: documents still need signature',
    $$Hi {{buyer_name}},

You still have a document waiting for signature in the portal.

Open item:
{{document_name}}

If you need help reviewing the document before signing, reply here and we can help.

Southwest Virginia Chihuahua$$,
    true,
    true,
    '{"buyer_name":"The Carter Family","document_name":"Health Guarantee"}'::jsonb
  ),
  (
    'vaccination_update',
    'care',
    'Vaccination Update',
    'Shares a care update when a vaccination entry is posted.',
    'email',
    'resend',
    '{{puppy_name}} care update',
    $$Hi {{buyer_name}},

We added a new care update for {{puppy_name}}.

Update:
{{care_update}}

You can also review the latest care and progress items in the portal.

Southwest Virginia Chihuahua$$,
    true,
    true,
    '{"buyer_name":"The Carter Family","puppy_name":"Baby Girl Frey","care_update":"First vaccine recorded and next due date is on file."}'::jsonb
  ),
  (
    'puppy_progress_update',
    'care',
    'Puppy Progress Update',
    'General breeder progress update for a puppy.',
    'email',
    'resend',
    'Progress update for {{puppy_name}}',
    $$Hi {{buyer_name}},

Here is the latest progress update for {{puppy_name}}:

{{progress_update}}

ChiChi and the portal will keep the newest updates together so you can review progress in one place.

Southwest Virginia Chihuahua$$,
    true,
    true,
    '{"buyer_name":"The Carter Family","puppy_name":"Baby Girl Frey","progress_update":"Walking well, eating independently, and photo set completed."}'::jsonb
  ),
  (
    'go_home_reminder',
    'placements',
    'Go-Home Reminder',
    'Pre-go-home checklist and reminder.',
    'email',
    'resend',
    'Go-home planning for {{puppy_name}}',
    $$Hi {{buyer_name}},

We are getting close to go-home time for {{puppy_name}}.

Current go-home target: {{go_home_date}}
Current checklist note: {{go_home_note}}

If you need help reviewing remaining steps, ChiChi can summarize the file for you in the portal.

Southwest Virginia Chihuahua$$,
    true,
    true,
    '{"buyer_name":"The Carter Family","puppy_name":"Baby Girl Frey","go_home_date":"June 12, 2026","go_home_note":"Buyer packet ready and transport details still being confirmed."}'::jsonb
  ),
  (
    'payment_default_notice',
    'payments',
    'Payment Default Notice',
    'Escalated overdue notice for accounts needing manual follow-up.',
    'email',
    'resend',
    'Important payment notice for {{puppy_name}}',
    $$Hi {{buyer_name}},

Your payment plan for {{puppy_name}} is significantly past due and now needs direct review.

Current balance snapshot: {{balance}}
Original due date: {{due_date}}

Please reply as soon as you can if you need help reviewing the account or making arrangements.

Southwest Virginia Chihuahua$$,
    true,
    true,
    '{"buyer_name":"The Carter Family","puppy_name":"Baby Girl Frey","due_date":"May 15, 2026","balance":"$1,800"}'::jsonb
  ),
  (
    'custom_breeder_outreach',
    'custom',
    'Custom Breeder Outreach',
    'Flexible breeder-to-buyer outreach template.',
    'email',
    'resend',
    '{{outreach_subject}}',
    $$Hi {{buyer_name}},

{{outreach_body}}

Southwest Virginia Chihuahua$$,
    false,
    true,
    '{"buyer_name":"The Carter Family","outreach_subject":"A quick update from Southwest Virginia Chihuahua","outreach_body":"We wanted to reach out with a quick progress note and next-step reminder."}'::jsonb
  )
on conflict (template_key) do nothing;

insert into public.admin_workflow_settings (
  workflow_key,
  category,
  label,
  description,
  status,
  owner,
  cadence_label,
  trigger_label,
  next_run_hint,
  settings,
  is_visible
)
values
  ('payment_reminders', 'payments', 'Payment Reminders', 'Tracks friendly reminder coverage before installments come due.', 'active', 'ChiChi', 'Daily review', 'Buyer payment due window', 'Reviews due dates and available templates each morning.', '{"mode":"automated","template_key":"payment_reminder"}'::jsonb, true),
  ('overdue_payment_follow_up', 'payments', 'Overdue Payment Follow-Up', 'Flags late and default notices that need breeder review or sending.', 'active', 'ChiChi', 'Daily review', 'Past-due payment accounts', 'Escalates when overdue thresholds are reached.', '{"mode":"automated","template_keys":["payment_overdue","payment_default_notice"]}'::jsonb, true),
  ('care_reminders', 'care', 'Care Reminders', 'Tracks puppies missing weekly weights, vaccines, and deworming entries.', 'active', 'Breeding Ops', 'Daily review', 'Care compliance gaps', 'Surfaces overdue weight and health items in the ops board.', '{"mode":"board","sources":["weights","health_records","checklist"]}'::jsonb, true),
  ('document_reminders', 'documents', 'Document Reminders', 'Monitors drafted, ready, unsigned, and filed buyer paperwork.', 'active', 'ChiChi', 'Daily review', 'Unsigned or blocked document packets', 'Pairs document status with buyer linkage and packet readiness.', '{"mode":"board","template_key":"signature_reminder"}'::jsonb, true),
  ('buyer_onboarding', 'buyers', 'Buyer Onboarding', 'Tracks reservation, payment, portal, and document onboarding steps.', 'active', 'ChiChi', 'Continuous', 'Buyer matched or approved', 'Uses readiness data to show the next recommended step.', '{"mode":"guided","template_key":"application_approved"}'::jsonb, true),
  ('portal_access_readiness', 'portal', 'Portal Access Readiness', 'Flags buyers who are linked but still missing portal access or visible updates.', 'monitoring', 'Portal Admin', 'Daily review', 'Buyer linked but portal not ready', 'Keeps portal readiness visible before publication and placement.', '{"mode":"monitor"}'::jsonb, true),
  ('go_home_preparation', 'placements', 'Go-Home Preparation', 'Tracks buyer packet, care, transport, and checklist milestones before go-home.', 'active', 'Breeding Ops', 'Twice weekly', 'Go-home window approaching', 'Combines checklist progress with care and document readiness.', '{"mode":"guided","template_key":"go_home_reminder"}'::jsonb, true),
  ('post_placement_follow_up', 'placements', 'Post-Placement Follow-Up', 'Keeps follow-up touchpoints visible after completion.', 'monitoring', 'ChiChi', 'Weekly review', 'Completed placements', 'Supports breeder outreach after puppies go home.', '{"mode":"monitor","template_key":"custom_breeder_outreach"}'::jsonb, true)
on conflict (workflow_key) do nothing;
