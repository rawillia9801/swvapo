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
    "Access-Control-Allow-Methods": "POST, OPTIONS",
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
    q.includes("do you have puppies")
  ) {
    return "We do not currently have any available puppies. Our next litter is expected mid June, and interested families are welcome to join our Wait List.";
  }

  if (q.includes("wait list") || q.includes("waitlist")) {
    return "You can join the Wait List using the form linked on the website. It is the best way to be notified first when upcoming availability opens.";
  }

  if (q.includes("apply") || q.includes("application")) {
    return "You can apply using the application page on the website. If you are planning ahead for an upcoming litter, joining the Wait List first is also a great step.";
  }

  if (q.includes("portal") || q.includes("puppy portal")) {
    return "The Puppy Portal is where approved families can view updates, messages, documents, financial details, and puppy progress.";
  }

  if (q.includes("go home") || q.includes("go-home")) {
    return "Puppies typically go home around 8 weeks old once they are eating solid food well and maintaining steady growth.";
  }

  if (q.includes("included") || q.includes("comes with")) {
    return "Families receive health records, vaccination information, starter food, and continued breeder support.";
  }

  if (q.includes("price") || q.includes("cost")) {
    return "Pricing can vary depending on registration, sex, and other details. For the most current information, please review the listings or reach out through the application or portal.";
  }

  if (q.includes("policy") || q.includes("policies")) {
    return "You can review policies from the Policies page on the website.";
  }

  if (q.includes("phone") || q.includes("contact") || q.includes("call")) {
    return "You can contact Southwest Virginia Chihuahua at (276) 378-0184.";
  }

  if (q.includes("emergency") || q.includes("vet") || q.includes("veterinarian")) {
    return "If this is an emergency, please contact your local veterinarian right away.";
  }

  return "I can help with questions about available puppies, the wait list, the application, policies, and the Puppy Portal.";
}

function buildSystemPrompt() {
  return `
You are ChiChi Assistant for the public Southwest Virginia Chihuahua website.

Your job:
- Answer public-facing questions warmly and clearly.
- Be personable and easy to talk to.
- Do not use markdown headings, bullets unless truly needed, or formal report formatting.
- Do not use ###, **, or blockquote style.
- Keep answers natural and conversational.
- Never claim to access private account, payment, buyer, or portal-only data.
- Never act like an admin assistant here.
- Never mention internal systems, Core, Supabase, or private records.

Public business context:
- Business: Southwest Virginia Chihuahua
- Location: Marion, VA
- Current availability: no puppies currently available
- Next litter expected: mid June
- Interested families should join the Wait List
- Puppy Portal exists for approved families
- Puppies typically go home around 8 weeks old once ready
- Families receive health records, vaccination information, starter food, and breeder support
- Phone: (276) 378-0184

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