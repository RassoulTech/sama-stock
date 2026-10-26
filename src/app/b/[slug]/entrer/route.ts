import { and, eq } from "drizzle-orm";
import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { db } from "@/db";
import { members } from "@/db/schema";
import { BUSINESS_COOKIE, CONTEXT_COOKIE_OPTIONS, getSession, LOCATION_COOKIE } from "@/server/context";
import { shopBySlug } from "@/server/queries/shop-login";

/** Après la connexion sur la page d'une boutique : ouvre son application (même si le compte a plusieurs commerces). */
export async function GET(request: Request, { params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const shop = await shopBySlug(slug);
  if (!shop) return NextResponse.redirect(new URL("/connexion", request.url));

  const session = await getSession();
  if (!session) return NextResponse.redirect(new URL(`/b/${shop.slug}`, request.url));

  const [member] = await db
    .select({ id: members.id })
    .from(members)
    .where(and(eq(members.userId, session.user.id), eq(members.businessId, shop.id)));
  if (!member) return NextResponse.redirect(new URL(`/b/${shop.slug}?acces=refuse`, request.url));

  const res = NextResponse.redirect(new URL("/tableau-de-bord", request.url));
  const jar = await cookies();
  if (jar.get(BUSINESS_COOKIE)?.value !== shop.id) {
    res.cookies.set(BUSINESS_COOKIE, shop.id, CONTEXT_COOKIE_OPTIONS);
    res.cookies.delete(LOCATION_COOKIE);
  }
  return res;
}
