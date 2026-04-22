export type ResendTemplateCategory =
  | "buyer_lifecycle"
  | "payments"
  | "documents"
  | "transport"
  | "puppy_updates"
  | "relationship";

export type ResendTemplateDefault = {
  templateKey: string;
  label: string;
  category: ResendTemplateCategory;
  description: string;
  subject: string;
  body: string;
  previewPayload: Record<string, string>;
};

export const RESEND_TEMPLATE_CATEGORY_LABELS: Record<ResendTemplateCategory, string> = {
  buyer_lifecycle: "Buyer Lifecycle",
  payments: "Payments",
  documents: "Documents",
  transport: "Transport",
  puppy_updates: "Puppy Updates",
  relationship: "Relationship",
};

export const RESEND_TEMPLATE_CATEGORIES = Object.keys(
  RESEND_TEMPLATE_CATEGORY_LABELS
) as ResendTemplateCategory[];

export const DEFAULT_RESEND_TEMPLATES: ResendTemplateDefault[] = [
  {
    templateKey: "buyer_application_received",
    label: "Application Received",
    category: "buyer_lifecycle",
    description:
      "Sent immediately after a buyer submits an application. Confirms receipt and sets expectations for next steps.",
    subject: "We received your application 🐾",
    body: `Hi {{buyer_name}},

Thank you for submitting your application.

We've received everything on our end and will be reviewing it shortly.

If we need anything additional, we'll reach out. Otherwise, you can expect an update once your application has been processed.

We appreciate your interest and look forward to working with you.

Southwest Virginia Chihuahua`,
    previewPayload: {
      buyer_name: "Sarah",
    },
  },
  {
    templateKey: "buyer_application_approved",
    label: "Application Approved",
    category: "buyer_lifecycle",
    description:
      "Sent when a buyer's application is approved. Invites them to move forward with reserving a puppy or next steps.",
    subject: "Your application has been approved 🐾",
    body: `Hi {{buyer_name}},

Great news - your application has been approved.

You're now able to move forward with reserving a puppy.

If you already have a specific puppy in mind, you can proceed with the reservation directly through your Puppy Portal. If you're still deciding, feel free to take your time - we're happy to help guide you if needed.

We look forward to helping you find the perfect match.

Southwest Virginia Chihuahua`,
    previewPayload: {
      buyer_name: "Sarah",
    },
  },
  {
    templateKey: "buyer_reservation_confirmed",
    label: "Reservation Confirmed",
    category: "buyer_lifecycle",
    description:
      "Sent when a buyer places a deposit and reserves a puppy. Confirms reservation and outlines next steps.",
    subject: "{{puppy_name}} is officially reserved 🐾",
    body: `Hi {{buyer_name}},

{{puppy_name}} is now officially reserved for you.

We've received your deposit, and everything is set on our end.

From here, you'll be able to follow along with updates, documents, and your payment plan directly through your Puppy Portal.

As {{puppy_name}} grows, we'll continue sharing updates and preparing for go-home day.

If anything comes up along the way, we're here - but otherwise, everything will be guided step-by-step inside your portal.

Southwest Virginia Chihuahua`,
    previewPayload: {
      buyer_name: "Sarah",
      puppy_name: "Bella",
    },
  },
  {
    templateKey: "buyer_go_home_ready",
    label: "Go-Home Ready",
    category: "buyer_lifecycle",
    description:
      "Sent when a puppy is approaching go-home readiness. Prepares the buyer for final steps, scheduling, and transition.",
    subject: "{{puppy_name}} is almost ready to go home 🐾",
    body: `Hi {{buyer_name}},

{{puppy_name}} is getting very close to go-home day.

Over the next few days, we'll be finalizing the remaining details to make sure everything is ready - including pickup or transportation, final documents, and any remaining balance.

You'll be able to review and complete everything through your Puppy Portal.

We'll guide you through each step so the transition is smooth and stress-free.

Southwest Virginia Chihuahua`,
    previewPayload: {
      buyer_name: "Sarah",
      puppy_name: "Bella",
    },
  },
  {
    templateKey: "payment_received",
    label: "Payment Receipt",
    category: "payments",
    description: "Automatic receipt sent when a buyer payment is posted.",
    subject: "Payment received for {{puppy_name}}",
    body: `Hi {{buyer_name}},

We've received your payment for {{puppy_name}}.

Amount received: {{amount_paid}}
Remaining balance: {{balance}}

Your account has been updated and reflected in your Puppy Portal.

Southwest Virginia Chihuahua`,
    previewPayload: {
      buyer_name: "Sarah",
      puppy_name: "Bella",
      amount_paid: "$300.00",
      balance: "$1,180.00",
    },
  },
  {
    templateKey: "payment_reminder_upcoming",
    label: "Payment Reminder",
    category: "payments",
    description: "Friendly reminder sent before an upcoming installment due date.",
    subject: "Upcoming payment for {{puppy_name}}",
    body: `Hi {{buyer_name}},

Just a quick heads up - your next payment for {{puppy_name}} is coming up on {{due_date}}.

Amount due: {{monthly_amount}}
Current balance: {{balance}}

You can take care of it anytime through your Puppy Portal.

As always, if anything changes on your end, we're here to work with you.

Southwest Virginia Chihuahua`,
    previewPayload: {
      buyer_name: "Sarah",
      puppy_name: "Bella",
      due_date: "May 1, 2026",
      monthly_amount: "$250.00",
      balance: "$1,180.00",
    },
  },
  {
    templateKey: "payment_late_notice",
    label: "Payment Overdue",
    category: "payments",
    description: "Operational overdue notice when an installment is past due.",
    subject: "Payment past due for {{puppy_name}}",
    body: `Hi {{buyer_name}},

We wanted to let you know that a scheduled payment for {{puppy_name}} is now past due.

Past due amount: {{amount_due}}
Current balance: {{balance}}

Please take a moment to bring the account current through your Puppy Portal.

If there's something going on, communication goes a long way - just let us know.

Southwest Virginia Chihuahua`,
    previewPayload: {
      buyer_name: "Sarah",
      puppy_name: "Bella",
      amount_due: "$250.00",
      balance: "$1,180.00",
    },
  },
  {
    templateKey: "payment_default_notice",
    label: "Payment Default Notice",
    category: "payments",
    description: "Escalated notice for significantly overdue accounts.",
    subject: "Immediate attention required for {{puppy_name}}'s account",
    body: `Hi {{buyer_name}},

Despite previous reminders, the account for {{puppy_name}} remains unresolved.

Immediate action is required to prevent further steps regarding the agreement.

Balance due: {{balance}}

Please log into your Puppy Portal today to resolve this.

Southwest Virginia Chihuahua`,
    previewPayload: {
      buyer_name: "Sarah",
      puppy_name: "Bella",
      balance: "$1,180.00",
    },
  },
  {
    templateKey: "payment_credit_applied",
    label: "Payment Credit Applied",
    category: "payments",
    description: "Use when a credit or manual adjustment changes the buyer balance.",
    subject: "A credit has been applied to {{puppy_name}}'s account",
    body: `Hi {{buyer_name}},

A credit has been applied to your account for {{puppy_name}}.

Updated balance: {{balance}}

This adjustment has already been reflected in your payment plan.

If you'd ever like a full breakdown of your account or schedule, everything is available inside your Puppy Portal.

Southwest Virginia Chihuahua`,
    previewPayload: {
      buyer_name: "Sarah",
      puppy_name: "Bella",
      balance: "$1,180.00",
    },
  },
  {
    templateKey: "payment_plan_created",
    label: "Payment Plan Created",
    category: "payments",
    description: "Sent when a buyer's payment plan is created and ready to review.",
    subject: "Your payment plan for {{puppy_name}} is ready",
    body: `Hi {{buyer_name}},

Your payment plan for {{puppy_name}} has been created and is ready inside your Puppy Portal.

Monthly amount: {{monthly_amount}}
Next due date: {{due_date}}
Current balance: {{balance}}

Please review the schedule when you have a moment so everything stays organized from the start.

Southwest Virginia Chihuahua`,
    previewPayload: {
      buyer_name: "Sarah",
      puppy_name: "Bella",
      monthly_amount: "$250.00",
      due_date: "May 1, 2026",
      balance: "$1,180.00",
    },
  },
  {
    templateKey: "payment_plan_updated",
    label: "Payment Plan Updated",
    category: "payments",
    description: "Sent when payment plan terms, schedule, or balance details are updated.",
    subject: "Your payment plan for {{puppy_name}} has been updated",
    body: `Hi {{buyer_name}},

We've updated the payment plan for {{puppy_name}}.

Updated monthly amount: {{monthly_amount}}
Next due date: {{due_date}}
Current balance: {{balance}}

The newest details are available in your Puppy Portal.

Southwest Virginia Chihuahua`,
    previewPayload: {
      buyer_name: "Sarah",
      puppy_name: "Bella",
      monthly_amount: "$225.00",
      due_date: "May 1, 2026",
      balance: "$1,180.00",
    },
  },
  {
    templateKey: "payment_paid_off",
    label: "Payment Paid Off",
    category: "payments",
    description: "Sent when a buyer's balance reaches zero.",
    subject: "{{puppy_name}}'s account is paid in full",
    body: `Hi {{buyer_name}},

Wonderful news - {{puppy_name}}'s account is now paid in full.

Your Puppy Portal has been updated to reflect the completed balance.

Thank you for keeping everything organized with us.

Southwest Virginia Chihuahua`,
    previewPayload: {
      buyer_name: "Sarah",
      puppy_name: "Bella",
    },
  },
  {
    templateKey: "documents_ready_to_sign",
    label: "Documents Ready to Sign",
    category: "documents",
    description: "Sent when buyer-facing documents are ready for review and signature.",
    subject: "Documents ready for your review and signature",
    body: `Hi {{buyer_name}},

Your documents for {{puppy_name}} are now ready.

Please take a few moments to review and sign them through your Puppy Portal.

Everything has been prepared for you, and once completed, your file will be fully up to date.

Southwest Virginia Chihuahua`,
    previewPayload: {
      buyer_name: "Sarah",
      puppy_name: "Bella",
    },
  },
  {
    templateKey: "documents_signature_reminder",
    label: "Signature Reminder",
    category: "documents",
    description: "Reminder sent when documents are still awaiting signature.",
    subject: "Reminder: documents still awaiting signature",
    body: `Hi {{buyer_name}},

This is a friendly reminder that documents for {{puppy_name}} are still waiting for your review and signature.

Please complete them through your Puppy Portal when you have a moment.

Southwest Virginia Chihuahua`,
    previewPayload: {
      buyer_name: "Sarah",
      puppy_name: "Bella",
    },
  },
  {
    templateKey: "documents_completed",
    label: "Documents Completed",
    category: "documents",
    description: "Sent when required documents have been signed and filed.",
    subject: "Your documents for {{puppy_name}} are complete",
    body: `Hi {{buyer_name}},

Your documents for {{puppy_name}} have been completed and filed.

Everything is up to date on our end, and your Puppy Portal will continue to show the latest placement steps.

Southwest Virginia Chihuahua`,
    previewPayload: {
      buyer_name: "Sarah",
      puppy_name: "Bella",
    },
  },
  {
    templateKey: "transport_quote_ready",
    label: "Transport Quote Ready",
    category: "transport",
    description: "Sent when a pickup, meet-up, or transport quote is ready for review.",
    subject: "Transport quote ready for {{puppy_name}}",
    body: `Hi {{buyer_name}},

Your transport quote for {{puppy_name}} is ready to review.

Estimated transport cost: {{transport_quote}}
Proposed location: {{meeting_location}}

You can review the details in your Puppy Portal and let us know what works best.

Southwest Virginia Chihuahua`,
    previewPayload: {
      buyer_name: "Sarah",
      puppy_name: "Bella",
      transport_quote: "$185.00",
      meeting_location: "Bristol, VA",
    },
  },
  {
    templateKey: "transport_scheduled",
    label: "Transport Scheduled",
    category: "transport",
    description: "Sent when transport has been scheduled for a buyer.",
    subject: "Transport scheduled for {{puppy_name}}",
    body: `Hi {{buyer_name}},

Your transport for {{puppy_name}} has been scheduled.

Date: {{transport_date}}
Location: {{meeting_location}}

We'll keep you updated as the day approaches so everything goes smoothly.

Southwest Virginia Chihuahua`,
    previewPayload: {
      buyer_name: "Sarah",
      puppy_name: "Bella",
      transport_date: "May 10, 2026",
      meeting_location: "Bristol, VA",
    },
  },
  {
    templateKey: "transport_day_reminder",
    label: "Transport Day Reminder",
    category: "transport",
    description: "Sent shortly before pickup, meet-up, or transport day.",
    subject: "Reminder: transport day for {{puppy_name}}",
    body: `Hi {{buyer_name}},

This is a quick reminder that transport for {{puppy_name}} is coming up.

Date: {{transport_date}}
Location: {{meeting_location}}
Time: {{meeting_time}}

Please keep your phone nearby that day so we can coordinate smoothly.

Southwest Virginia Chihuahua`,
    previewPayload: {
      buyer_name: "Sarah",
      puppy_name: "Bella",
      transport_date: "May 10, 2026",
      meeting_location: "Bristol, VA",
      meeting_time: "2:00 PM",
    },
  },
  {
    templateKey: "puppy_weekly_update",
    label: "Weekly Puppy Update",
    category: "puppy_updates",
    description: "General weekly puppy progress update.",
    subject: "{{puppy_name}} update 🐾",
    body: `Hi {{buyer_name}},

We wanted to share a quick update on {{puppy_name}}.

{{custom_update}}

We'll continue keeping you updated as {{puppy_name}} grows and gets closer to going home.

Southwest Virginia Chihuahua`,
    previewPayload: {
      buyer_name: "Sarah",
      puppy_name: "Bella",
      custom_update: "Bella had a great week and is continuing to do well.",
    },
  },
  {
    templateKey: "puppy_milestone_update",
    label: "Puppy Milestone Update",
    category: "puppy_updates",
    description: "Sent when a meaningful development or readiness milestone is shared.",
    subject: "{{puppy_name}} reached a new milestone 🐾",
    body: `Hi {{buyer_name}},

{{puppy_name}} reached a new milestone.

Milestone: {{milestone_label}}
Update: {{milestone_note}}

We love being able to share these little steps as your puppy grows.

Southwest Virginia Chihuahua`,
    previewPayload: {
      buyer_name: "Sarah",
      puppy_name: "Bella",
      milestone_label: "Walking well",
      milestone_note: "Bella is getting steadier every day.",
    },
  },
  {
    templateKey: "post_go_home_checkin",
    label: "Post Go-Home Check-In",
    category: "relationship",
    description: "Sent after placement to check in and support the transition home.",
    subject: "Checking in on {{puppy_name}}",
    body: `Hi {{buyer_name}},

We wanted to check in and see how {{puppy_name}} is settling in.

The first few days can be exciting and full, so please reach out if you have any questions about food, routines, or the transition.

We're always happy to help.

Southwest Virginia Chihuahua`,
    previewPayload: {
      buyer_name: "Sarah",
      puppy_name: "Bella",
    },
  },
  {
    templateKey: "buyer_referral_request",
    label: "Referral Request",
    category: "relationship",
    description: "Sent to happy families after placement to invite referrals or reviews.",
    subject: "A small favor from Southwest Virginia Chihuahua",
    body: `Hi {{buyer_name}},

We hope {{puppy_name}} is doing beautifully with your family.

If you've had a wonderful experience with us, we would be grateful if you shared our name with another Chihuahua-loving family or left a kind review.

Thank you again for trusting us.

Southwest Virginia Chihuahua`,
    previewPayload: {
      buyer_name: "Sarah",
      puppy_name: "Bella",
    },
  },
];

export const REQUIRED_RESEND_TEMPLATE_KEYS = DEFAULT_RESEND_TEMPLATES.map(
  (template) => template.templateKey
);

export const PAYMENT_NOTICE_TEMPLATE_KEYS = {
  receipt: "payment_received",
  due_reminder: "payment_reminder_upcoming",
  late_notice: "payment_late_notice",
  default_notice: "payment_default_notice",
} as const;

export const LEGACY_PAYMENT_NOTICE_TEMPLATE_KEYS = {
  receipt: "payment_receipt",
  due_reminder: "payment_reminder",
  late_notice: "payment_overdue",
  default_notice: "payment_default_notice",
} as const;
