import { NextResponse } from "next/server";
import { describeRouteError, verifyOwner } from "@/lib/admin-api";

export const runtime = "nodejs";

const ASSUMED_MPG = 31;
const GAS_SERIES_URL =
  "https://www.eia.gov/dnav/pet/hist/LeafHandler.ashx?f=M&n=PET&s=EMM_EPMR_PTE_R1Z_DPG";
const GAS_PRICE_SERIES_LABEL =
  "Lower Atlantic (PADD 1C) Regular All Formulations Retail Gasoline Prices";

let cachedMonthlyPrices: Map<string, number> | null = null;
let cachedAt = 0;

function cleanCell(html: string) {
  return String(html || "")
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/gi, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function monthKeyFromIso(value: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  const year = date.getUTCFullYear();
  const month = date.getUTCMonth() + 1;
  return `${year}-${String(month).padStart(2, "0")}`;
}

async function loadMonthlyGasPrices() {
  const now = Date.now();
  if (cachedMonthlyPrices && now - cachedAt < 1000 * 60 * 60 * 12) {
    return cachedMonthlyPrices;
  }

  const response = await fetch(GAS_SERIES_URL, {
    next: { revalidate: 60 * 60 * 12 },
  });

  if (!response.ok) {
    throw new Error("Could not load the monthly gasoline pricing table.");
  }

  const html = await response.text();
  const rows = html.match(/<tr[\s\S]*?<\/tr>/gi) || [];
  const map = new Map<string, number>();

  for (const row of rows) {
    const cells = row.match(/<t[dh][\s\S]*?<\/t[dh]>/gi) || [];
    if (cells.length < 13) continue;

    const values = cells.map(cleanCell);
    const year = values[0].replace(/[^\d]/g, "");
    if (!/^\d{4}$/.test(year)) continue;

    for (let monthIndex = 1; monthIndex <= 12; monthIndex += 1) {
      const rawValue = values[monthIndex]?.replace(/[^0-9.]/g, "") || "";
      const parsed = Number(rawValue);
      if (!Number.isFinite(parsed)) continue;
      map.set(`${year}-${String(monthIndex).padStart(2, "0")}`, parsed);
    }
  }

  if (!map.size) {
    throw new Error("The gasoline pricing table did not return any monthly values.");
  }

  cachedMonthlyPrices = map;
  cachedAt = now;
  return map;
}

function findPriceForMonth(prices: Map<string, number>, requestedMonth: string) {
  if (prices.has(requestedMonth)) {
    return {
      month: requestedMonth,
      price: prices.get(requestedMonth) || 0,
      isFallback: false,
    };
  }

  const candidate = Array.from(prices.keys())
    .filter((key) => key <= requestedMonth)
    .sort();

  const resolvedCandidate = candidate[candidate.length - 1];

  if (!resolvedCandidate) return null;

  return {
    month: resolvedCandidate,
    price: prices.get(resolvedCandidate) || 0,
    isFallback: true,
  };
}

export async function GET(req: Request) {
  try {
    const owner = await verifyOwner(req);
    if (!owner) {
      return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });
    }

    const url = new URL(req.url);
    const isoDate = String(url.searchParams.get("date") || "").trim();
    const miles = Number(url.searchParams.get("miles") || 0);

    if (!isoDate || !Number.isFinite(miles) || miles < 0) {
      return NextResponse.json(
        { ok: false, error: "Date and mileage are required." },
        { status: 400 }
      );
    }

    const requestedMonth = monthKeyFromIso(isoDate);
    if (!requestedMonth) {
      return NextResponse.json(
        { ok: false, error: "The transportation date is not valid." },
        { status: 400 }
      );
    }

    const prices = await loadMonthlyGasPrices();
    const resolved = findPriceForMonth(prices, requestedMonth);

    if (!resolved) {
      return NextResponse.json(
        { ok: false, error: "No gasoline price data is available for that month." },
        { status: 404 }
      );
    }

    const gallonsEstimated = miles / ASSUMED_MPG;
    const estimatedFuelCost = gallonsEstimated * resolved.price;

    return NextResponse.json({
      ok: true,
      requestedMonth,
      priceMonth: resolved.month,
      usedFallbackMonth: resolved.isFallback,
      pricePerGallon: resolved.price,
      miles,
      assumedVehicle: "2014 Kia Rio",
      assumedMpg: ASSUMED_MPG,
      gallonsEstimated,
      estimatedFuelCost,
      pricingSeries: GAS_PRICE_SERIES_LABEL,
      ownerEmail: owner.email || null,
    });
  } catch (error) {
    console.error("Transportation fuel estimate error:", error);
    return NextResponse.json(
      {
        ok: false,
        error: describeRouteError(error, "Could not estimate the transportation fuel cost."),
      },
      { status: 500 }
    );
  }
}
