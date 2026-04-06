import { NextResponse } from "next/server";
import { createServiceSupabase } from "@/lib/admin-api";
import { shouldHidePublicPuppyPrice } from "@/lib/lineage";

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
  notes?: string | null;
  created_at?: string | null;
};

const PUBLIC_PUPPY_SELECT =
  "id,litter_id,litter_name,dam_id,sire_id,call_name,puppy_name,name,sire,dam,sex,color,coat_type,coat,pattern,dob,registry,price,list_price,status,image_url,photo_url,description,notes,created_at";

export async function GET() {
  try {
    const service = createServiceSupabase();
    const { data, error } = await service
      .from("puppies")
      .select(PUBLIC_PUPPY_SELECT)
      .order("created_at", { ascending: false });

    if (error) {
      throw error;
    }

    const puppies = ((data || []) as PublicPuppyRow[]).map((puppy) => {
      const hidePrice = shouldHidePublicPuppyPrice(puppy.status);
      return {
        ...puppy,
        price: hidePrice ? null : puppy.price ?? puppy.list_price ?? null,
        list_price: hidePrice ? null : puppy.list_price ?? puppy.price ?? null,
      };
    });

    return NextResponse.json({ ok: true, puppies });
  } catch (error) {
    console.error("Public puppies route error:", error);
    return NextResponse.json(
      {
        ok: false,
        error: error instanceof Error ? error.message : "Unknown error",
        puppies: [],
      },
      { status: 500 }
    );
  }
}
