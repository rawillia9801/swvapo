import { NextResponse } from "next/server";
import { createServiceSupabase, describeRouteError, verifyOwner } from "@/lib/admin-api";
import {
  plainTextEmailHtml,
  parseTemplatePayload,
  renderMessageTemplate,
} from "@/lib/message-template-renderer";
import { getResendClient, hasResendConfiguration } from "@/lib/resend";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const NO_STORE_HEADERS = { "Cache-Control": "no-store" };

type StoredTemplateRow = {
  template_key?: string | null;
  category?: string | null;
  label?: string | null;
  subject?: string | null;
  body?: string | null;
  provider?: string | null;
  preview_payload?: Record<string, unknown> | null;
};

function text(value: unknown) {
  return String(value || "").trim();
}

function normalizeEmail(value: unknown) {
  return text(value).toLowerCase();
}

function isEmail(value: string) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
}

function isSchemaError(error: unknown) {
  const message = (error instanceof Error ? error.message : String(error || "")).toLowerCase();
  return (
    message.includes("does not exist") ||
    message.includes("column") ||
    message.includes("schema cache") ||
    message.includes("could not find the table")
  );
}

function fromAddress() {
  return (
    text(process.env.RESEND_TEST_FROM_EMAIL) ||
    text(process.env.PAYMENT_NOTICES_FROM_EMAIL) ||
    text(process.env.RESEND_FROM_EMAIL) ||
    "Southwest Virginia Chihuahua <billing@noreply.swvachihuahua.com>"
  );
}

async function loadStoredTemplate(templateKey: string) {
  const service = createServiceSupabase();
  const result = await service
    .from("admin_message_templates")
    .select("template_key,category,label,subject,body,provider,preview_payload")
    .eq("template_key", templateKey)
    .limit(1)
    .maybeSingle<StoredTemplateRow>();

  if (result.error) throw result.error;
  if (!result.data) throw new Error("The selected template could not be found.");

  return result.data;
}

async function storeTestSend(input: {
  templateKey: string;
  category: string;
  label: string;
  recipientEmail: string;
  subject: string;
  providerMessageId: string | null;
  renderMode: string;
  payload: Record<string, unknown>;
  missingVariables: string[];
  sentByEmail: string | null;
}) {
  try {
    const service = createServiceSupabase();
    const result = await service.from("admin_message_template_test_sends").insert({
      template_key: input.templateKey,
      category: input.category || null,
      label: input.label || null,
      recipient_email: input.recipientEmail,
      subject: input.subject,
      provider: "resend",
      provider_message_id: input.providerMessageId,
      status: "sent",
      render_mode: input.renderMode,
      payload: input.payload,
      missing_variables: input.missingVariables,
      sent_by_email: input.sentByEmail,
      meta: {
        test_only: true,
      },
    });

    if (result.error && !isSchemaError(result.error)) {
      throw result.error;
    }
  } catch (error) {
    if (!isSchemaError(error)) {
      throw error;
    }
  }
}

export async function POST(req: Request) {
  try {
    const owner = await verifyOwner(req);
    if (!owner) {
      return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });
    }

    if (!hasResendConfiguration()) {
      return NextResponse.json(
        { ok: false, error: "Resend is not configured. Add RESEND_API_KEY before sending tests." },
        { status: 503 }
      );
    }

    const body = (await req.json()) as Record<string, unknown>;
    const mode = text(body.mode) === "saved" ? "saved" : "draft";
    const recipientEmail = normalizeEmail(body.recipientEmail);

    if (!recipientEmail || !isEmail(recipientEmail)) {
      return NextResponse.json(
        { ok: false, error: "Enter a valid test recipient email address." },
        { status: 400 }
      );
    }

    let templateKey = text(body.templateKey);
    let label = text(body.label);
    let category = text(body.category);
    let subject = text(body.subject);
    let templateBody = text(body.body);
    let previewPayload: unknown = body.previewPayload;

    if (mode === "saved") {
      if (!templateKey) {
        return NextResponse.json(
          { ok: false, error: "Choose a saved template before sending a saved-template test." },
          { status: 400 }
        );
      }

      const stored = await loadStoredTemplate(templateKey);
      templateKey = text(stored.template_key);
      label = text(stored.label);
      category = text(stored.category);
      subject = text(stored.subject);
      templateBody = text(stored.body);
      previewPayload = body.previewPayload || stored.preview_payload || {};
    }

    if (!subject || !templateBody) {
      return NextResponse.json(
        { ok: false, error: "A subject and body are required before sending a test." },
        { status: 400 }
      );
    }

    const parsedPayload = parseTemplatePayload(previewPayload);
    if (!parsedPayload.ok) {
      return NextResponse.json(
        { ok: false, error: `Preview payload JSON is invalid: ${parsedPayload.error}` },
        { status: 400 }
      );
    }

    const rendered = renderMessageTemplate({
      subject,
      body: templateBody,
      payload: parsedPayload.payload,
      missingMode: "mark",
    });
    const resend = getResendClient();
    const testSubject = `[TEST] ${rendered.subject}`;
    const replyTo =
      text(process.env.PAYMENT_NOTICES_REPLY_TO) ||
      text(process.env.RESEND_REPLY_TO_EMAIL) ||
      text(process.env.RESEND_FROM_EMAIL) ||
      undefined;

    const sendResult = await resend.emails.send({
      from: fromAddress(),
      to: recipientEmail,
      replyTo,
      subject: testSubject,
      text: `TEST EMAIL - not sent to a buyer automatically.\nTemplate: ${label || templateKey || "Unsaved draft"}\n\n${rendered.body}`,
      html: plainTextEmailHtml({
        eyebrow: "Resend template test",
        subject: testSubject,
        body: `TEST EMAIL - not sent to a buyer automatically.\nTemplate: ${label || templateKey || "Unsaved draft"}\n\n${rendered.body}`,
        footer: "This was sent from the Southwest Virginia Chihuahua admin template editor.",
      }),
    });

    if (sendResult.error) {
      throw new Error(sendResult.error.message || "Resend could not send the test email.");
    }

    const providerMessageId = sendResult.data?.id || null;
    await storeTestSend({
      templateKey: templateKey || "unsaved_draft",
      category,
      label: label || "Unsaved Draft",
      recipientEmail,
      subject: testSubject,
      providerMessageId,
      renderMode: mode,
      payload: parsedPayload.payload,
      missingVariables: rendered.missingVariables,
      sentByEmail: owner.email || null,
    });

    return NextResponse.json(
      {
        ok: true,
        providerMessageId,
        recipientEmail,
        subject: testSubject,
        missingVariables: rendered.missingVariables,
      },
      { headers: NO_STORE_HEADERS }
    );
  } catch (error) {
    return NextResponse.json(
      {
        ok: false,
        error: describeRouteError(error, "Could not send the template test email."),
      },
      { status: 500 }
    );
  }
}
