import { NextResponse } from "next/server";

type PublicRequestBody = {
  message?: string;
  source?: string;
  page?: string;
};

function getAllowedOrigin(origin: string | null) {
  const allowedOrigins = [
    "https://swvachihuahua.com",
    "https://www.swvachihuahua.com",
    "http://swvachihuahua.com",
    "http://www.swvachihuahua.com",
    "http://localhost:3000",
    "http://127.0.0.1:3000",
  ];

  if (origin && allowedOrigins.includes(origin)) {
    return origin;
  }

  return "https://swvachihuahua.com";
}

function withCors(origin: string | null, extra: Record<string, string> = {}) {
  return {
    "Access-Control-Allow-Origin": getAllowedOrigin(origin),
    "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type",
    "Access-Control-Max-Age": "86400",
    ...extra,
  };
}

function localPublicFallback(message: string) {
  const q = String(message || "").trim().toLowerCase();

  if (!q) return "Please type a question and I’ll help however I can.";

  if (
    q.includes("available") ||
    q.includes("available puppies") ||
    q.includes("puppies right now") ||
    q.includes("do you have puppies") ||
    q.includes("do you have any puppies") ||
    q.includes("any puppies") ||
    q.includes("have puppies")
  ) {
    return "We do not currently have any available puppies. Our next litter is expected mid June, and interested families are welcome to join our Wait List.";
  }

  if (
    q.includes("next litter") ||
    q.includes("upcoming litter") ||
    q.includes("when is your next litter") ||
    q.includes("when are you expecting")
  ) {
    return "Our next litter is expected mid June.";
  }

  if (
    q.includes("wait list") ||
    q.includes("waitlist") ||
    q.includes("join the wait list") ||
    q.includes("join wait list")
  ) {
    return "You can join the Wait List using the form linked on the website. It is the best way to be notified first when upcoming availability opens.";
  }

  if (
    q.includes("apply") ||
    q.includes("application") ||
    q.includes("how do i apply")
  ) {
    return "You can apply using the application page on the website. If you are planning ahead for an upcoming litter, joining the Wait List first is also a great step.";
  }

  if (
    q.includes("portal") ||
    q.includes("puppy portal") ||
    q.includes("client portal")
  ) {
    return "The Puppy Portal is where approved families can view updates, messages, documents, financial details, and puppy progress.";
  }

  if (
    q.includes("payment plan") ||
    q.includes("payment plans") ||
    q.includes("financing") ||
    q.includes("finance") ||
    q.includes("pay over time") ||
    q.includes("installment") ||
    q.includes("installments") ||
    q.includes("monthly payments")
  ) {
    return "We may offer puppy payment plans in some situations. Our standard payment plan requires 50% down, with the remaining balance paid over up to 6 months. References and other verifiable information may be required. Registration papers and the bill of sale are not released until the puppy is paid in full, and buyers must agree to the terms of service.";
  }

  if (
    q.includes("deposit") ||
    q.includes("deposits")
  ) {
    return "Deposits are used to reserve a puppy or secure placement, depending on the situation. For the most accurate current terms, please review the policies page or reach out directly through the application or portal.";
  }

  if (
    q.includes("policy") ||
    q.includes("policies")
  ) {
    return "Our policies cover reservations, payment terms, transport or delivery, go-home timing, buyer responsibilities, and health-related information. The best place to review them in full is the Policies page on the website.";
  }

  if (
    q.includes("health guarantee") ||
    q.includes("guarantee")
  ) {
    return "Our puppies go home with health records and breeder support. For the full health guarantee terms and buyer responsibilities, please review the Policies page or the buyer documents provided through the process.";
  }

  if (
    q.includes("delivery") ||
    q.includes("transport") ||
    q.includes("pickup") ||
    q.includes("meet")
  ) {
    return "We do offer transport or meet-up options in some situations. Transport pricing and scheduling depend on distance and arrangements. For the most accurate details, please review the policies page or contact us directly.";
  }

  if (
    q.includes("go home") ||
    q.includes("go-home") ||
    q.includes("when can puppies go home")
  ) {
    return "Puppies typically go home around 8 weeks old once they are eating solid food well and maintaining steady growth.";
  }

  if (
    q.includes("included") ||
    q.includes("what comes with") ||
    q.includes("comes with the puppy")
  ) {
    return "Families receive health records, vaccination information, starter food, and continued breeder support.";
  }

  if (
    q.includes("price") ||
    q.includes("cost") ||
    q.includes("how much")
  ) {
    return "Pricing can vary depending on registration, sex, and other details. For the most current information, please review the listings or reach out through the application or portal.";
  }

  if (
    q.includes("phone") ||
    q.includes("contact") ||
    q.includes("call")
  ) {
    return "You can contact Southwest Virginia Chihuahua at (276) 378-0184.";
  }

  if (
    q.includes("emergency") ||
    q.includes("vet") ||
    q.includes("veterinarian")
  ) {
    return "If this is an emergency, please contact your local veterinarian right away.";
  }

  return "I’d be happy to help. You can ask me about available puppies, the wait list, payment plans, policies, applying, or the Puppy Portal.";
}

function buildSystemPrompt() {
  return `
You are ChiChi Assistant for the public Southwest Virginia Chihuahua website.

Your job:
- Answer public-facing questions warmly and clearly.
- Be personable and easy to talk to.
- Keep answers natural and conversational.
- Do not use markdown headings, bullets unless truly needed, or formal report formatting.
- Do not use ###, **, or blockquote style.
- Never claim to access private account, payment, buyer, or portal-only data.
- Never act like an admin assistant here.
- Never mention internal systems, Core, Supabase, or private records.
- If something may vary by circumstance, say so plainly.
- When policies are involved, give a helpful summary and mention the Policies page for full details.

Public business context:
- Business: Southwest Virginia Chihuahua
- Location: Marion, VA
- Phone: (276) 378-0184
- Current availability: no puppies currently available
- Next litter expected: mid June
- Interested families should join the Wait List
- Puppy Portal exists for approved families
- Puppies typically go home around 8 weeks old once ready
- Families receive health records, vaccination information, starter food, and breeder support

Public policy/payment guidance:
- Payment plans may be offered in some situations
- Standard payment plan: 50% down
- Remaining balance may be paid over up to 6 months
- References and other verifiable information may be required
- Registration papers and bill of sale are not released until the puppy is paid in full
- Buyers must agree to the terms of service
- Transport or delivery options may be available depending on circumstances and distance
- Policies page is the best source for full official terms

Style:
- Friendly
- Calm
- Reassuring
- Short to medium length
- No markdown symbols or heading markup
- No fake certainty
`.trim();
}

export async function GET(req: Request) {
  const origin = req.headers.get("origin");
  return NextResponse.json(
    {
      ok: true,
      route: "chichi-public",
      message: "ChiChi public endpoint is live.",
    },
    {
      status: 200,
      headers: withCors(origin),
    }
  );
}

export async function OPTIONS(req: Request) {
  const origin = req.headers.get("origin");
  return new NextResponse(null, {
    status: 204,
    headers: withCors(origin),
  });
}

export async function POST(req: Request) {
  const origin = req.headers.get("origin");

  try {
    const body = (await req.json()) as PublicRequestBody;
    const message = String(body.message || "").trim();

    if (!message) {
      return NextResponse.json(
        { text: "Please type a question and I’ll help however I can." },
        {
          status: 400,
          headers: withCors(origin),
        }
      );
    }

    const apiKey = process.env.ANTHROPIC_API_KEY;
    const model = process.env.ANTHROPIC_PUBLIC_MODEL;

    if (!apiKey || !model) {
      return NextResponse.json(
        { text: localPublicFallback(message) },
        {
          status: 200,
          headers: withCors(origin),
        }
      );
    }

    const response = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": apiKey,
        "anthropic-version": "2023-06-01",
      },
      body: JSON.stringify({
        model,
        max_tokens: 500,
        system: buildSystemPrompt(),
        messages: [
          {
            role: "user",
            content: message,
          },
        ],
      }),
    });

    if (!response.ok) {
      return NextResponse.json(
        { text: localPublicFallback(message) },
        {
          status: 200,
          headers: withCors(origin),
        }
      );
    }

    const data = await response.json();
    const text =
      String(data?.content?.[0]?.text || "").trim() || localPublicFallback(message);

    return NextResponse.json(
      { text },
      {
        status: 200,
        headers: withCors(origin),
      }
    );
  } catch {
    return NextResponse.json(
      { text: "I had a little trouble answering that. Please try again." },
      {
        status: 200,
        headers: withCors(origin),
      }
    );
  }
}