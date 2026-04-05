export type PickupRequestType = "" | "pickup" | "meet" | "dropoff" | "transportation";

export const FREE_MILES_ONE_WAY = 50;
export const RATE_PER_MILE = 1.25;
export const MINIMUM_DELIVERY_FEE = 75;
export const LOCAL_DELIVERY_RADIUS = 200;

export function formatTransportationMoney(value: number | null | undefined) {
  if (value === null || value === undefined || Number.isNaN(Number(value))) return "Not listed";
  return Number(value).toLocaleString("en-US", {
    style: "currency",
    currency: "USD",
  });
}

export function calculateTransportEstimate(
  requestType: PickupRequestType,
  milesRaw: string | number | null | undefined
) {
  const miles =
    typeof milesRaw === "number"
      ? milesRaw
      : milesRaw === null || milesRaw === undefined || milesRaw === ""
        ? Number.NaN
        : Number(milesRaw);

  if (requestType === "pickup") {
    return {
      fee: 0,
      label: formatTransportationMoney(0),
      detail: "Pickup at our location does not include a transportation fee.",
    };
  }

  if (requestType === "transportation") {
    return {
      fee: null,
      label: "Custom quote required",
      detail:
        "Flight nanny, courier, and third-party transportation are priced separately and confirmed before scheduling.",
    };
  }

  if (requestType === "meet" || requestType === "dropoff") {
    if (!Number.isFinite(miles) || miles < 0) {
      return {
        fee: null,
        label: "Enter mileage",
        detail: `The first ${FREE_MILES_ONE_WAY} miles are free. Beyond that, pricing is ${formatTransportationMoney(
          RATE_PER_MILE
        )} per mile one-way with a ${formatTransportationMoney(
          MINIMUM_DELIVERY_FEE
        )} minimum fee beyond the free-mile zone.`,
      };
    }

    if (miles <= FREE_MILES_ONE_WAY) {
      return {
        fee: 0,
        label: formatTransportationMoney(0),
        detail: `This trip falls within the first ${FREE_MILES_ONE_WAY} one-way miles included at no charge.`,
      };
    }

    const billableMiles = miles - FREE_MILES_ONE_WAY;
    const rawFee = billableMiles * RATE_PER_MILE;
    const fee = Math.max(MINIMUM_DELIVERY_FEE, rawFee);
    const extraNote =
      miles > LOCAL_DELIVERY_RADIUS
        ? ` This request is beyond the normal ${LOCAL_DELIVERY_RADIUS}-mile local range and may require breeder approval or added travel arrangements.`
        : "";

    return {
      fee,
      label: formatTransportationMoney(fee),
      detail: `${billableMiles.toFixed(1).replace(/\.0$/, "")} billable one-way miles x ${formatTransportationMoney(
        RATE_PER_MILE
      )} = ${formatTransportationMoney(rawFee)}. Minimum fee applies beyond ${FREE_MILES_ONE_WAY} miles.${extraNote}`,
    };
  }

  return {
    fee: null,
    label: "Not available",
    detail: "Select a request type to see how pricing applies.",
  };
}
