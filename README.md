# SWVAPO

SWVAPO is the customer Puppy Portal and breeder administration workspace for
Southwest Virginia Chihuahua. It is a Next.js application backed by Supabase
and connected to the breeder's live puppy, buyer, application, document,
payment, transportation, health, and messaging records.

## Product areas

### Customer portal

- secure account creation, sign-in, and password recovery
- buyer dashboard and homecoming journey
- live available-puppy listings
- puppy profile, lineage, weight, health, and milestone updates
- applications, contracts, documents, and signatures
- payments, financing details, receipts, and reminders
- pickup and delivery planning
- breeder messages, notifications, resources, and account management
- ChiChi portal assistant grounded in the signed-in family's records

### Breeder administration

- applications and buyer workspace
- current and past puppy operations
- dams, sires, litters, lineage, and genetics
- buyer documents and contract workflow
- payments, financing, notices, and Zoho integrations
- transportation planning
- portal messages and website conversations
- Resend template administration
- portal users, integration health, and workflow settings

## Local development

Requirements:

- Node.js 22 or newer
- npm
- a Supabase project containing the portal schema

Install and run:

```bash
npm ci
npm run dev
```

Then open `http://localhost:3000/portal`.

Quality checks:

```bash
npx tsc --noEmit
npm run lint
npm run build
```

The production build no longer downloads Google fonts. It uses a resilient
system-font stack so local, CI, and Vercel builds do not depend on an external
font request.

## Environment

Core portal access requires:

```text
NEXT_PUBLIC_SUPABASE_URL
NEXT_PUBLIC_SUPABASE_ANON_KEY
SUPABASE_SERVICE_ROLE_KEY
NEXT_PUBLIC_APP_URL
```

Optional integrations require their corresponding variables:

- Resend: `RESEND_API_KEY`, sender/reply-to values, and webhook secret
- Zoho: OAuth, Payments, Sign, Forms, and Writer template values
- ChiChi: `ANTHROPIC_API_KEY`
- scheduled jobs: `CRON_SECRET`

Never commit service-role keys, OAuth secrets, webhook secrets, or email
credentials.

## Database migrations

Migrations are stored in `supabase/migrations` and should be applied in
timestamp order.

The portal experience foundation migration adds per-user notification
dismissals with row-level security:

```text
supabase/migrations/20260724_portal_experience_foundation.sql
```

Until that migration is applied, notification dismissals still work on the
current device through a local browser fallback. Applying the migration makes
the state follow the user across devices.

## Data and privacy rules

- Customer pages must read only records tied to the authenticated user, buyer,
  or assigned puppy.
- Administrative writes must use verified admin access.
- Public puppy listings must respect `puppy_admin_profiles.public_visibility`.
- Public listing responses must not include buyer data, owner email, breeder
  notes, internal care flags, costs, or private pricing.
- Reserved and completed puppy prices remain private.

## Deployment

The repository is designed for Vercel. Push a verified commit only after the
local production build succeeds so each release consumes one deployment rather
than a sequence of partial builds.
