import { NextRequest, NextResponse } from "next/server";

export function proxy(request: NextRequest) {
  const destination = new URL("https://swvaos.site/portal/login");
  const next = request.nextUrl.searchParams.get("next");
  if (next) destination.searchParams.set("next", next);
  return NextResponse.redirect(destination, 307);
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico)$).*)"],
};
