import { NextRequest, NextResponse } from "next/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type ZohoTokenResponse = {
  access_token?: string;
  refresh_token?: string;
  api_domain?: string;
  token_type?: string;
  expires_in?: number;
  scope?: string;
  error?: string;
  error_description?: string;
  [key: string]: unknown;
};

function getRequiredEnv(name: string, fallback?: string) {
  const value = process.env[name]?.trim();
  if (value) return value;
  if (fallback) return fallback;
  throw new Error(`Missing required environment variable: ${name}`);
}

function escapeHtml(value: unknown) {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

function renderPage({
  title,
  heading,
  message,
  status = 200,
  details = "",
}: {
  title: string;
  heading: string;
  message: string;
  status?: number;
  details?: string;
}) {
  const html = `<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>${escapeHtml(title)}</title>
    <style>
      :root {
        color-scheme: light;
        --bg: #f7f4ee;
        --card: rgba(255,255,255,0.92);
        --border: rgba(15, 23, 42, 0.10);
        --text: #111827;
        --muted: #6b7280;
        --accent: #1d4ed8;
        --accent-soft: rgba(29, 78, 216, 0.08);
        --success: #166534;
        --danger: #991b1b;
        --shadow: 0 24px 80px rgba(15, 23, 42, 0.10);
      }

      * { box-sizing: border-box; }

      body {
        margin: 0;
        min-height: 100vh;
        font-family: Inter, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
        color: var(--text);
        background:
          radial-gradient(circle at top left, rgba(59, 130, 246, 0.10), transparent 30%),
          radial-gradient(circle at top right, rgba(236, 72, 153, 0.08), transparent 24%),
          linear-gradient(180deg, #fbfbfd 0%, #f7f4ee 100%);
        padding: 28px 18px;
      }

      .wrap {
        max-width: 920px;
        margin: 0 auto;
      }

      .card {
        background: var(--card);
        border: 1px solid var(--border);
        border-radius: 28px;
        overflow: hidden;
        box-shadow: var(--shadow);
        backdrop-filter: blur(18px);
      }

      .hero {
        padding: 28px 28px 18px;
        background:
          linear-gradient(135deg, rgba(29, 78, 216, 0.10), rgba(255,255,255,0.25)),
          linear-gradient(180deg, rgba(255,255,255,0.86), rgba(255,255,255,0.72));
        border-bottom: 1px solid var(--border);
      }

      .eyebrow {
        display: inline-flex;
        align-items: center;
        gap: 8px;
        border-radius: 999px;
        padding: 8px 12px;
        background: var(--accent-soft);
        color: var(--accent);
        font-size: 12px;
        font-weight: 800;
        letter-spacing: 0.04em;
        text-transform: uppercase;
      }

      h1 {
        margin: 16px 0 10px;
        font-size: clamp(30px, 4vw, 42px);
        line-height: 1.05;
        letter-spacing: -0.03em;
      }

      .lead {
        margin: 0;
        color: var(--muted);
        line-height: 1.7;
        font-size: 16px;
      }

      .body {
        padding: 22px 28px 30px;
      }

      .panel {
        margin-top: 16px;
        padding: 18px;
        border-radius: 22px;
        border: 1px solid var(--border);
        background: rgba(255,255,255,0.86);
      }

      .panel h2 {
        margin: 0 0 12px;
        font-size: 18px;
      }

      .grid {
        display: grid;
        gap: 14px;
      }

      .token-row {
        border: 1px solid var(--border);
        border-radius: 18px;
        padding: 14px 16px;
        background: rgba(248, 250, 252, 0.9);
      }

      .label {
        margin-bottom: 8px;
        color: var(--muted);
        font-size: 12px;
        font-weight: 800;
        text-transform: uppercase;
        letter-spacing: 0.04em;
      }

      .value {
        font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, "Liberation Mono", monospace;
        font-size: 13px;
        line-height: 1.7;
        word-break: break-word;
        white-space: pre-wrap;
      }

      .note {
        margin-top: 16px;
        padding: 14px 16px;
        border-radius: 18px;
        border: 1px solid rgba(29, 78, 216, 0.14);
        background: rgba(29, 78, 216, 0.07);
        color: #1e3a8a;
        line-height: 1.7;
      }

      .danger {
        color: var(--danger);
      }

      .success {
        color: var(--success);
      }

      ol {
        margin: 0;
        padding-left: 20px;
        color: var(--muted);
        line-height: 1.8;
      }

      .footer {
        margin-top: 18px;
        color: var(--muted);
        font-size: 13px;
      }
    </style>
  </head>
  <body>
    <main class="wrap">
      <section class="card">
        <div class="hero">
          <div class="eyebrow">Zoho OAuth Callback</div>
          <h1>${escapeHtml(heading)}</h1>
          <p class="lead">${escapeHtml(message)}</p>
        </div>
        <div class="body">
          ${details}
          <p class="footer">Southwest Virginia Chihuahua · Puppy Portal / ChiChi</p>
        </div>
      </section>
    </main>
  </body>
</html>`;

  return new NextResponse(html, {
    status,
    headers: {
      "content-type": "text/html; charset=utf-8",
      "cache-control": "no-store, no-cache, must-revalidate, proxy-revalidate",
      pragma: "no-cache",
      expires: "0",
    },
  });
}

async function exchangeAuthorizationCode(code: string) {
  const accountsDomain = getRequiredEnv(
    "ZOHO_ACCOUNTS_DOMAIN",
    "https://accounts.zoho.com"
  );
  const clientId = getRequiredEnv("ZOHO_CLIENT_ID");
  const clientSecret = getRequiredEnv("ZOHO_CLIENT_SECRET");
  const redirectUri = getRequiredEnv(
    "ZOHO_REDIRECT_URI",
    "https://portal.swvachihuahua.com/api/integrations/zoho/callback"
  );

  const form = new URLSearchParams();
  form.set("grant_type", "authorization_code");
  form.set("client_id", clientId);
  form.set("client_secret", clientSecret);
  form.set("redirect_uri", redirectUri);
  form.set("code", code);

  const response = await fetch(`${accountsDomain}/oauth/v2/token`, {
    method: "POST",
    headers: {
      "content-type": "application/x-www-form-urlencoded",
    },
    body: form.toString(),
    cache: "no-store",
  });

  const raw = await response.text();

  let data: ZohoTokenResponse;
  try {
    data = JSON.parse(raw) as ZohoTokenResponse;
  } catch {
    data = {
      error: "invalid_json_response",
      error_description: raw,
    };
  }

  return {
    ok: response.ok,
    status: response.status,
    data,
    raw,
  };
}

export async function GET(request: NextRequest) {
  const url = new URL(request.url);
  const error = url.searchParams.get("error");
  const errorDescription = url.searchParams.get("error_description");
  const code = url.searchParams.get("code");
  const location = url.searchParams.get("location");
  const accountsServer = url.searchParams.get("accounts-server");

  if (error) {
    return renderPage({
      title: "Zoho Authorization Error",
      heading: "Zoho returned an authorization error",
      message: errorDescription || error,
      status: 400,
      details: `
        <div class="panel">
          <h2 class="danger">Returned values</h2>
          <div class="grid">
            <div class="token-row">
              <div class="label">error</div>
              <div class="value">${escapeHtml(error)}</div>
            </div>
            <div class="token-row">
              <div class="label">error_description</div>
              <div class="value">${escapeHtml(errorDescription || "")}</div>
            </div>
            <div class="token-row">
              <div class="label">location</div>
              <div class="value">${escapeHtml(location || "")}</div>
            </div>
            <div class="token-row">
              <div class="label">accounts-server</div>
              <div class="value">${escapeHtml(accountsServer || "")}</div>
            </div>
          </div>
        </div>
      `,
    });
  }

  if (!code) {
    return renderPage({
      title: "Zoho Callback Ready",
      heading: "Zoho callback route is live",
      message:
        "The route is deployed and ready, but there is no authorization code in the URL yet.",
      details: `
        <div class="panel">
          <h2>Next step</h2>
          <ol>
            <li>Open your corrected Zoho authorization URL.</li>
            <li>Click accept/consent.</li>
            <li>Zoho will redirect back here with a temporary code.</li>
            <li>This route will immediately exchange that code for tokens.</li>
          </ol>
        </div>
      `,
    });
  }

  try {
    const result = await exchangeAuthorizationCode(code);

    if (!result.ok || result.data.error) {
      return renderPage({
        title: "Zoho Token Exchange Failed",
        heading: "Zoho sent the code, but token exchange failed",
        message:
          result.data.error_description ||
          result.data.error ||
          "Zoho did not return a successful token response.",
        status: 400,
        details: `
          <div class="panel">
            <h2 class="danger">Exchange details</h2>
            <div class="grid">
              <div class="token-row">
                <div class="label">status</div>
                <div class="value">${escapeHtml(result.status)}</div>
              </div>
              <div class="token-row">
                <div class="label">code</div>
                <div class="value">${escapeHtml(code)}</div>
              </div>
              <div class="token-row">
                <div class="label">location</div>
                <div class="value">${escapeHtml(location || "")}</div>
              </div>
              <div class="token-row">
                <div class="label">accounts-server</div>
                <div class="value">${escapeHtml(accountsServer || "")}</div>
              </div>
              <div class="token-row">
                <div class="label">raw response</div>
                <div class="value">${escapeHtml(result.raw)}</div>
              </div>
            </div>
          </div>
          <div class="note">
            Most often this means the code expired, the redirect URI does not exactly match,
            or the production environment variables are not set on Vercel.
          </div>
        `,
      });
    }

    return renderPage({
      title: "Zoho Connected",
      heading: "Zoho authorization succeeded",
      message:
        "Your callback route worked and Zoho returned tokens. Save the refresh token in your Vercel environment variables.",
      details: `
        <div class="panel">
          <h2 class="success">Returned token values</h2>
          <div class="grid">
            <div class="token-row">
              <div class="label">access_token</div>
              <div class="value">${escapeHtml(result.data.access_token || "")}</div>
            </div>
            <div class="token-row">
              <div class="label">refresh_token</div>
              <div class="value">${escapeHtml(result.data.refresh_token || "")}</div>
            </div>
            <div class="token-row">
              <div class="label">api_domain</div>
              <div class="value">${escapeHtml(result.data.api_domain || "")}</div>
            </div>
            <div class="token-row">
              <div class="label">token_type</div>
              <div class="value">${escapeHtml(result.data.token_type || "")}</div>
            </div>
            <div class="token-row">
              <div class="label">expires_in</div>
              <div class="value">${escapeHtml(result.data.expires_in || "")}</div>
            </div>
            <div class="token-row">
              <div class="label">scope</div>
              <div class="value">${escapeHtml(result.data.scope || "")}</div>
            </div>
            <div class="token-row">
              <div class="label">accounts-server</div>
              <div class="value">${escapeHtml(accountsServer || "")}</div>
            </div>
            <div class="token-row">
              <div class="label">location</div>
              <div class="value">${escapeHtml(location || "")}</div>
            </div>
          </div>
        </div>

        <div class="note">
          Put the <strong>refresh_token</strong> into Vercel as <strong>ZOHO_REFRESH_TOKEN</strong>.
          The access token is temporary. The refresh token is the one your server will keep using
          to get fresh access tokens later.
        </div>

        <div class="panel">
          <h2>Environment variables you should have</h2>
          <div class="value">ZOHO_ACCOUNTS_DOMAIN=https://accounts.zoho.com
ZOHO_API_DOMAIN=https://www.zohoapis.com
ZOHO_CLIENT_ID=your_client_id
ZOHO_CLIENT_SECRET=your_client_secret
ZOHO_REFRESH_TOKEN=paste_refresh_token_here
ZOHO_REDIRECT_URI=https://portal.swvachihuahua.com/api/integrations/zoho/callback</div>
        </div>
      `,
    });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Unknown callback error";

    return renderPage({
      title: "Zoho Callback Error",
      heading: "The callback route is live, but an error occurred",
      message,
      status: 500,
      details: `
        <div class="panel">
          <h2 class="danger">What to check</h2>
          <ol>
            <li>Make sure the route is deployed to Vercel.</li>
            <li>Make sure ZOHO_CLIENT_ID is set in Vercel.</li>
            <li>Make sure ZOHO_CLIENT_SECRET is set in Vercel.</li>
            <li>Make sure ZOHO_REDIRECT_URI exactly matches the Zoho app configuration.</li>
            <li>After fixing anything, run the Zoho consent URL again to get a fresh code.</li>
          </ol>
        </div>
      `,
    });
  }
}