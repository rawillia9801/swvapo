import type { PortalPuppy } from "@/lib/portal-data";
import { resolvePublicPuppyPrice } from "@/lib/lineage";
import { buildPuppyPhotoUrl } from "@/lib/utils";

export function publicPuppyName(puppy: PortalPuppy) {
  return puppy.call_name || puppy.puppy_name || puppy.name || "Unnamed Puppy";
}

export function publicPuppyStatus(puppy: PortalPuppy) {
  return String(puppy.status || "").trim();
}

export function publicPuppySex(puppy: PortalPuppy) {
  return String(puppy.sex || "").trim();
}

export function publicPuppyColor(puppy: PortalPuppy) {
  return String(puppy.color || "").trim();
}

export function publicPuppyCoat(puppy: PortalPuppy) {
  return String(puppy.coat_type || puppy.coat || "").trim();
}

export function publicPuppyRegistry(puppy: PortalPuppy) {
  return String(puppy.registry || "").trim();
}

export function publicPuppyDescription(puppy: PortalPuppy) {
  return String(puppy.description || puppy.notes || "").trim();
}

export function publicPuppyPhotoUrl(puppy: PortalPuppy) {
  const direct = String(puppy.photo_url || puppy.image_url || "").trim();
  if (!direct) return "";
  if (direct.startsWith("http")) return direct;
  return buildPuppyPhotoUrl(direct);
}

export function publicPuppyPrice(puppy: PortalPuppy) {
  return resolvePublicPuppyPrice({
    status: puppy.status,
    list_price: puppy.list_price,
    price: puppy.price,
  });
}

export function publicPuppyAgeLabel(puppy: PortalPuppy) {
  const rawDate = puppy.dob;
  if (!rawDate) return "";
  const birthDate = new Date(rawDate);
  if (Number.isNaN(birthDate.getTime())) return "";

  const today = new Date();
  const diffDays = Math.max(
    0,
    Math.floor((today.getTime() - birthDate.getTime()) / (1000 * 60 * 60 * 24))
  );
  const weeks = Math.floor(diffDays / 7);

  if (weeks < 1) {
    return `${diffDays} day${diffDays === 1 ? "" : "s"} old`;
  }

  return `${weeks} week${weeks === 1 ? "" : "s"} old`;
}

export function publicPuppyStatusLabel(statusRaw: string) {
  const status = String(statusRaw || "").toLowerCase();
  if (status.includes("available")) return "Available";
  if (status.includes("reserved")) return "Reserved";
  if (status.includes("hold")) return "On Hold";
  if (status.includes("expected")) return "Expected";
  if (status.includes("adopted") || status.includes("sold") || status.includes("completed")) {
    return "Completed";
  }
  return statusRaw || "Pending";
}
