import { NextResponse } from "next/server";
import { createServiceSupabase } from "@/lib/admin-api";
import { shouldHidePublicPuppyPrice } from "@/lib/lineage";
import { isPublicPuppyListingStatus } from "@/lib/public-puppy-listing";

type PublicPuppyRow = {
  id: number;
  litter_id?: number | null;
  litter_name?: string | null;
  dam_id?: string | null;
  sire_id?: string | null;
  call_name?: string | null;
  puppy_name?: string | null;
  name?: string | null;
  sire?: string | null;
  dam?: string | null;
  sex?: string | null;
  color?: string | null;
  coat_type?: string | null;
  coat?: string | null;
  pattern?: string | null;
  dob?: string | null;
  registry?: string | null;
  price?: number | null;
  list_price?: number | null;
  status?: string | null;
  image_url?: string | null;
  photo_url?: string | null;
  description?: string | null;
  created_at?: string | null;
};

type PublicProfileRow = {
  puppy_id: number;
  public_visibility?: boolean | null;
  featured_listing?: boolean | null;
};

const PUBLIC_PUPPY_SELECT =
  "id,litter_id,litter_name,dam_id,sire_id,call_name,puppy_name,name,sire,dam,sex,color,coat_type,coat,pattern,dob,registry,price,list_price,status,image_url,photo_url,description,created_at";

export async function GET() {
  try {
    const service = createServiceSupabase();
    const [{ data, error }, { data: profileData, error: profileError }] =
      await Promise.all([
        service
          .from("puppies")
          .select(PUBLIC_PUPPY_SELECT)
          .order("created_at", { ascending: false }),
        service
          .from("puppy_admin_profiles")
          .select("puppy_id,public_visibility,featured_listing"),
      ]);

    if (error) {
      throw error;
    }

    const profiles = profileError
      ? []
      : ((profileData || []) as PublicProfileRow[]);
    const profileByPuppyId = new Map(
      profiles.map((profile) => [Number(profile.puppy_id), profile] as const),
    );

    const puppies = ((data || []) as PublicPuppyRow[])
      .filter((puppy) => {
        const profile = profileByPuppyId.get(Number(puppy.id));
        return (
          profile?.public_visibility !== false &&
          isPublicPuppyListingStatus(puppy.status)
        );
      })
      .map((puppy) => {
        const profile = profileByPuppyId.get(Number(puppy.id));
        const hidePrice = shouldHidePublicPuppyPrice(puppy.status);
        return {
          ...puppy,
          featured_listing: Boolean(profile?.featured_listing),
          price: hidePrice ? null : (puppy.price ?? puppy.list_price ?? null),
          list_price: hidePrice
            ? null
            : (puppy.list_price ?? puppy.price ?? null),
        };
      })
      .sort((left, right) => {
        if (left.featured_listing !== right.featured_listing) {
          return left.featured_listing ? -1 : 1;
        }
        return (
          new Date(right.created_at || 0).getTime() -
          new Date(left.created_at || 0).getTime()
        );
      });

    return NextResponse.json(
      { ok: true, puppies },
      {
        headers: {
          "Cache-Control": "public, s-maxage=30, stale-while-revalidate=120",
        },
      },
    );
  } catch (error) {
    console.error("Public puppies route error:", error);
    return NextResponse.json(
      {
        ok: false,
        error: "Puppy listings are temporarily unavailable.",
        puppies: [],
      },
      { status: 500 },
    );
  }
}
