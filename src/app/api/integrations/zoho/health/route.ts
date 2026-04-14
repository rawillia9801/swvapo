import { NextResponse } from "next/server";
import { getZohoRuntimeStatus } from "@/lib/zoho/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const status = await getZohoRuntimeStatus();

    return NextResponse.json(
      {
        ok: true,
        message: "Zoho refresh-token authentication is working.",
        zoho: {
          accountsDomain: status.accountsDomain,
          apiDomain: status.apiDomain,
          tokenType: status.tokenType,
          expiresAt: status.expiresAt,
        },
        config: {
          hasClientId: status.hasClientId,
          hasClientSecret: status.hasClientSecret,
          hasRefreshToken: status.hasRefreshToken,
          hasRedirectUri: status.hasRedirectUri,
          hasSignOrgId: status.hasSignOrgId,
          hasWebhookSecret: status.hasWebhookSecret,
          hasDepositTemplate: status.hasDepositTemplate,
          hasBillOfSaleTemplate: status.hasBillOfSaleTemplate,
          hasHealthGuaranteeTemplate: status.hasHealthGuaranteeTemplate,
          hasFinancingAddendumTemplate: status.hasFinancingAddendumTemplate,
        },
        next: {
          oauth: "done",
          writerTemplates:
            "add your Writer template ids to Vercel when ready",
          sign:
            "add ZOHO_SIGN_ORG_ID and ZOHO_SIGN_WEBHOOK_SECRET when ready",
        },
      },
      {
        status: 200,
        headers: {
          "cache-control": "no-store",
        },
      }
    );
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Unknown Zoho health error";

    return NextResponse.json(
      {
        ok: false,
        message,
      },
      {
        status: 500,
        headers: {
          "cache-control": "no-store",
        },
      }
    );
  }
}