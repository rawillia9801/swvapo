import { NextResponse } from "next/server";
import { verifyOwner } from "@/lib/admin-api";

export const runtime = "nodejs";

type IntegrationGroup = {
  id: string;
  label: string;
  ready: boolean;
  summary: string;
  missing: string[];
};

function readConfiguredEnv(name: string) {
  return Boolean(String(process.env[name] || "").trim());
}

function buildGroup(id: string, label: string, requiredKeys: string[], summary: string) {
  const missing = requiredKeys.filter((key) => !readConfiguredEnv(key));
  return {
    id,
    label,
    ready: missing.length === 0,
    summary,
    missing,
  } satisfies IntegrationGroup;
}

export async function GET(req: Request) {
  const owner = await verifyOwner(req);
  if (!owner) {
    return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });
  }

  const groups = [
    buildGroup(
      "zoho_payments",
      "Zoho Payment Links",
      [
        "ZOHO_PAYMENTS_CLIENT_ID",
        "ZOHO_PAYMENTS_CLIENT_SECRET",
        "ZOHO_PAYMENTS_REDIRECT_URI",
        "ZOHO_PAYMENTS_SOID",
        "ZOHO_PAYMENTS_SIGNING_KEY",
      ],
      "One-time payment links, deposits, and portal charges."
    ),
    buildGroup(
      "zoho_billing",
      "Zoho Billing Subscriptions",
      [
        "ZOHO_BILLING_ORGANIZATION_ID",
        "ZOHO_BILLING_CLIENT_ID",
        "ZOHO_BILLING_CLIENT_SECRET",
        "ZOHO_BILLING_REFRESH_TOKEN",
        "ZOHO_BILLING_DEFAULT_PLAN_CODE",
        "ZOHO_BILLING_WEBHOOK_SECRET",
      ],
      "Recurring puppy payment plans and hosted subscription checkout."
    ),
    buildGroup(
      "payment_notices",
      "Payment Notice Emails",
      ["RESEND_API_KEY", "PAYMENT_NOTICES_FROM_EMAIL", "RESEND_WEBHOOK_SECRET"],
      "Payment receipts, due reminders, late notices, default notices, and Resend event tracking."
    ),
    buildGroup(
      "cron_notices",
      "Scheduled Notice Cron",
      ["CRON_SECRET"],
      "Daily reminder automation for due, late, and default notices."
    ),
  ];

  return NextResponse.json({
    ok: true,
    groups,
    checkedAt: new Date().toISOString(),
  });
}
