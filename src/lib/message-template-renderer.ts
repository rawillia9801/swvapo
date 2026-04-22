export type TemplatePayload = Record<string, unknown>;

export type ParsedTemplatePayload =
  | {
      ok: true;
      payload: TemplatePayload;
      normalized: string;
      error: "";
    }
  | {
      ok: false;
      payload: TemplatePayload;
      normalized: string;
      error: string;
    };

export type RenderMissingMode = "mark" | "preserve" | "blank";

export type RenderedTemplate = {
  subject: string;
  body: string;
  missingVariables: string[];
  usedVariables: string[];
};

const TOKEN_PATTERN = /\{\{\s*([a-zA-Z0-9_]+)\s*\}\}/g;

export function parseTemplatePayload(value: unknown): ParsedTemplatePayload {
  if (value && typeof value === "object" && !Array.isArray(value)) {
    return {
      ok: true,
      payload: value as TemplatePayload,
      normalized: JSON.stringify(value, null, 2),
      error: "",
    };
  }

  const raw = String(value || "").trim();
  if (!raw) {
    return {
      ok: true,
      payload: {},
      normalized: "{}",
      error: "",
    };
  }

  try {
    const parsed = JSON.parse(raw);
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
      return {
        ok: false,
        payload: {},
        normalized: raw,
        error: "Preview payload must be a JSON object.",
      };
    }

    return {
      ok: true,
      payload: parsed as TemplatePayload,
      normalized: JSON.stringify(parsed, null, 2),
      error: "",
    };
  } catch (error) {
    return {
      ok: false,
      payload: {},
      normalized: raw,
      error: error instanceof Error ? error.message : "Preview payload is not valid JSON.",
    };
  }
}

export function extractTemplateVariables(...values: string[]) {
  const variables = new Set<string>();

  values.forEach((value) => {
    String(value || "").replace(TOKEN_PATTERN, (_match, token) => {
      variables.add(String(token || "").trim());
      return "";
    });
  });

  return Array.from(variables).filter(Boolean).sort();
}

function normalizePayloadValue(value: unknown) {
  if (value == null) return "";
  if (typeof value === "string") return value;
  if (typeof value === "number" || typeof value === "boolean") return String(value);
  return JSON.stringify(value);
}

function replacementForMissing(token: string, missingMode: RenderMissingMode) {
  if (missingMode === "blank") return "";
  if (missingMode === "preserve") return `{{${token}}}`;
  return `[[missing:${token}]]`;
}

export function renderTemplateString(
  template: string,
  payload: TemplatePayload,
  missingMode: RenderMissingMode = "mark"
) {
  const missingVariables = new Set<string>();
  const usedVariables = new Set<string>();

  const rendered = String(template || "").replace(TOKEN_PATTERN, (_match, token) => {
    const key = String(token || "").trim();
    usedVariables.add(key);

    if (!Object.prototype.hasOwnProperty.call(payload, key) || payload[key] == null) {
      missingVariables.add(key);
      return replacementForMissing(key, missingMode);
    }

    return normalizePayloadValue(payload[key]);
  });

  return {
    text: rendered,
    missingVariables: Array.from(missingVariables).sort(),
    usedVariables: Array.from(usedVariables).sort(),
  };
}

export function renderMessageTemplate(input: {
  subject: string;
  body: string;
  payload: TemplatePayload;
  missingMode?: RenderMissingMode;
}): RenderedTemplate {
  const subject = renderTemplateString(
    input.subject,
    input.payload,
    input.missingMode || "mark"
  );
  const body = renderTemplateString(input.body, input.payload, input.missingMode || "mark");

  return {
    subject: subject.text,
    body: body.text,
    missingVariables: Array.from(
      new Set([...subject.missingVariables, ...body.missingVariables])
    ).sort(),
    usedVariables: Array.from(new Set([...subject.usedVariables, ...body.usedVariables])).sort(),
  };
}

export function escapeHtml(value: string) {
  return String(value || "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

export function plainTextEmailHtml(input: {
  eyebrow?: string;
  subject: string;
  body: string;
  footer?: string;
}) {
  const bodyHtml = escapeHtml(input.body)
    .replace(/\r\n/g, "\n")
    .replace(/\n{2,}/g, "</p><p>")
    .replace(/\n/g, "<br />");

  return `<!doctype html>
<html>
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>${escapeHtml(input.subject)}</title>
  </head>
  <body style="margin:0;background:#f7f1e9;color:#3b2a20;font-family:Georgia,'Times New Roman',serif;">
    <div style="display:none;max-height:0;overflow:hidden;opacity:0;">${escapeHtml(input.eyebrow || input.subject)}</div>
    <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background:#f7f1e9;padding:32px 16px;">
      <tr>
        <td align="center">
          <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="max-width:640px;border:1px solid #ead9c7;background:#fffdf9;border-radius:24px;overflow:hidden;">
            <tr>
              <td style="padding:28px 28px 10px 28px;">
                <div style="font-family:Arial,sans-serif;font-size:11px;letter-spacing:0.18em;text-transform:uppercase;color:#9a7656;font-weight:700;">${escapeHtml(input.eyebrow || "Southwest Virginia Chihuahua")}</div>
                <h1 style="margin:12px 0 0 0;font-size:26px;line-height:1.18;color:#3b2a20;font-weight:700;">${escapeHtml(input.subject)}</h1>
              </td>
            </tr>
            <tr>
              <td style="padding:14px 28px 30px 28px;font-family:Arial,sans-serif;font-size:15px;line-height:1.75;color:#5d4637;">
                <p>${bodyHtml}</p>
              </td>
            </tr>
          </table>
          <div style="max-width:640px;margin:14px auto 0 auto;font-family:Arial,sans-serif;font-size:12px;line-height:1.6;color:#8c7566;text-align:center;">
            ${escapeHtml(input.footer || "Southwest Virginia Chihuahua")}
          </div>
        </td>
      </tr>
    </table>
  </body>
</html>`;
}
